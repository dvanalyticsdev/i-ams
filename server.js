import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { MongoClient } from 'mongodb';
import { DEFAULT_EXPENSE_CATEGORIES } from './src/services/categoryDefaults.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'i-ams';
const categoryDocumentKey = 'expense-categories';

if (!mongoUri) {
  throw new Error('Missing MONGO_URI in environment.');
}

const client = new MongoClient(mongoUri, {
  dbName,
});

let database;

const sanitizeExpense = (expense) => {
  const sanitized = {
    expenseId: String(expense.expenseId || '').trim(),
    date: String(expense.date || '').trim(),
    category: String(expense.category || '').trim(),
    subCategory: String(expense.subCategory || '').trim(),
    amount: Number(expense.amount),
    paymentMode: String(expense.paymentMode || '').trim(),
    vendorName: String(expense.vendorName || '').trim(),
    department: String(expense.department || '').trim(),
    employeeName: String(expense.employeeName || '').trim(),
    description: String(expense.description || '').trim(),
    attachment: String(expense.attachment || '').trim(),
  };

  if (expense.importBatchId) {
    sanitized.importBatchId = String(expense.importBatchId).trim();
  }
  if (expense.importFileName) {
    sanitized.importFileName = String(expense.importFileName).trim();
  }
  if (expense.importedAt) {
    sanitized.importedAt = String(expense.importedAt).trim();
  }

  return sanitized;
};

const assertExpense = (expense) => {
  if (!expense.date) throw new Error('Date is required');
  if (!expense.category) throw new Error('Category is required');
  if (!expense.subCategory) throw new Error('Sub-category is required');
  if (!Number.isFinite(expense.amount) || expense.amount <= 0) throw new Error('Amount must be a positive number');
  if (!expense.paymentMode) throw new Error('Payment mode is required');
  if (!expense.vendorName) throw new Error('Vendor name is required');
  if (!expense.department) throw new Error('Department is required');
  if (!expense.employeeName) throw new Error('Employee name is required');
};

const cloneDefaultCategories = () => JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));

const normalizeCategories = (categories) =>
  Object.fromEntries(
    Object.entries(categories)
      .map(([category, subCategories]) => [
        String(category).trim(),
        [...new Set((subCategories || []).map((subCategory) => String(subCategory).trim()).filter(Boolean))],
      ])
      .filter(([category]) => Boolean(category))
  );

const getExpensesCollection = () => database.collection('expenses');
const getCategoriesCollection = () => database.collection('settings');

const getCategoriesDocument = async () => {
  const collection = getCategoriesCollection();
  const existing = await collection.findOne({ key: categoryDocumentKey });

  if (existing?.categories) {
    return existing;
  }

  const defaults = cloneDefaultCategories();
  const nextDocument = {
    key: categoryDocumentKey,
    categories: defaults,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await collection.updateOne(
    { key: categoryDocumentKey },
    { $set: nextDocument },
    { upsert: true }
  );

  return nextDocument;
};

const saveCategoriesDocument = async (categories) => {
  const normalized = normalizeCategories(categories);
  await getCategoriesCollection().updateOne(
    { key: categoryDocumentKey },
    {
      $set: {
        categories: normalized,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return normalized;
};

const getNextExpenseId = async (dateValue) => {
  const expenseDate = new Date(dateValue || Date.now());
  const year = expenseDate.getFullYear();
  const prefix = `EXP-${year}-`;
  const latestExpense = await getExpensesCollection()
    .find({ expenseId: { $regex: `^${prefix}` } })
    .sort({ expenseId: -1 })
    .limit(1)
    .next();

  const lastSequence = latestExpense
    ? Number.parseInt(String(latestExpense.expenseId).split('-')[2], 10) || 0
    : 0;

  return `EXP-${year}-${String(lastSequence + 1).padStart(4, '0')}`;
};

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (_request, response) => {
  response.json({ ok: true, database: dbName });
});

app.get('/api/expenses', async (_request, response) => {
  const expenses = await getExpensesCollection().find({}, { projection: { _id: 0 } }).sort({ date: -1, expenseId: -1 }).toArray();
  response.json(expenses);
});

app.post('/api/expenses', async (request, response) => {
  try {
    const payload = sanitizeExpense(request.body || {});
    payload.expenseId = await getNextExpenseId(payload.date);
    if (!payload.date) {
      payload.date = new Date().toISOString().split('T')[0];
    }
    assertExpense(payload);

    await getExpensesCollection().insertOne(payload);
    response.status(201).json(payload);
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.put('/api/expenses/:expenseId', async (request, response) => {
  try {
    const payload = sanitizeExpense({
      ...request.body,
      expenseId: request.params.expenseId,
    });
    assertExpense(payload);

    const result = await getExpensesCollection().findOneAndUpdate(
      { expenseId: payload.expenseId },
      { $set: payload },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    if (!result) {
      response.status(404).json({ message: 'Expense not found' });
      return;
    }

    response.json(result);
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.post('/api/expenses/bulk', async (request, response) => {
  try {
    const entries = Array.isArray(request.body?.expenses) ? request.body.expenses : [];
    if (!entries.length) {
      throw new Error('No expenses supplied');
    }

    const savedExpenses = [];
    for (const entry of entries) {
      const payload = sanitizeExpense(entry);
      if (!payload.expenseId) {
        payload.expenseId = await getNextExpenseId(payload.date);
      }
      if (!payload.date) {
        payload.date = new Date().toISOString().split('T')[0];
      }
      assertExpense(payload);

      await getExpensesCollection().updateOne(
        { expenseId: payload.expenseId },
        { $set: payload },
        { upsert: true }
      );
      savedExpenses.push(payload);
    }

    response.status(201).json(savedExpenses);
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.delete('/api/expenses/:expenseId', async (request, response) => {
  const result = await getExpensesCollection().deleteOne({ expenseId: request.params.expenseId });
  response.json({ success: result.deletedCount > 0 });
});

app.delete('/api/expenses/import-batch/:importBatchId', async (request, response) => {
  const result = await getExpensesCollection().deleteMany({ importBatchId: request.params.importBatchId });
  response.json({ removedCount: result.deletedCount });
});

app.get('/api/categories', async (_request, response) => {
  const document = await getCategoriesDocument();
  response.json(document.categories);
});

app.post('/api/categories/init', async (_request, response) => {
  const document = await getCategoriesDocument();
  response.json(document.categories);
});

app.post('/api/categories', async (request, response) => {
  try {
    const categoryName = String(request.body?.categoryName || '').trim();
    if (!categoryName) {
      throw new Error('Category name is required');
    }

    const current = (await getCategoriesDocument()).categories;
    if (current[categoryName]) {
      throw new Error('Category already exists');
    }

    current[categoryName] = [];
    response.status(201).json(await saveCategoriesDocument(current));
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.delete('/api/categories/:categoryName', async (request, response) => {
  const categoryName = request.params.categoryName;
  const current = (await getCategoriesDocument()).categories;
  delete current[categoryName];
  response.json(await saveCategoriesDocument(current));
});

app.post('/api/categories/:categoryName/subcategories', async (request, response) => {
  try {
    const categoryName = request.params.categoryName;
    const subCategoryName = String(request.body?.subCategoryName || '').trim();
    if (!subCategoryName) {
      throw new Error('Sub-category name is required');
    }

    const current = (await getCategoriesDocument()).categories;
    if (!current[categoryName]) {
      throw new Error('Category not found');
    }
    if (current[categoryName].includes(subCategoryName)) {
      throw new Error('Sub-category already exists');
    }

    current[categoryName] = [...current[categoryName], subCategoryName];
    response.status(201).json(await saveCategoriesDocument(current));
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.delete('/api/categories/:categoryName/subcategories/:subCategoryName', async (request, response) => {
  const { categoryName, subCategoryName } = request.params;
  const current = (await getCategoriesDocument()).categories;
  if (!current[categoryName]) {
    response.json(await saveCategoriesDocument(current));
    return;
  }

  current[categoryName] = current[categoryName].filter((entry) => entry !== subCategoryName);
  response.json(await saveCategoriesDocument(current));
});

app.use((error, _request, response, _next) => {
  response.status(500).json({ message: error.message || 'Unexpected server error' });
});

const start = async () => {
  await client.connect();
  database = client.db(dbName);
  await getExpensesCollection().createIndex({ expenseId: 1 }, { unique: true });
  await getCategoriesDocument();

  app.listen(port, () => {
    console.log(`Mongo API listening on http://localhost:${port} using database "${dbName}"`);
  });
};

start().catch((error) => {
  console.error('Failed to start Mongo API:', error);
  process.exit(1);
});
