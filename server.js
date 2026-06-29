import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';
import { DEFAULT_EXPENSE_CATEGORIES } from './src/services/categoryDefaults.js';

const app = express();

const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
};

const generateSalt = () => {
  return crypto.randomBytes(16).toString('hex');
};
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'i-ams';
const categoryDocumentKey = 'expense-categories';
const departmentDocumentKey = 'expense-departments';
const isVercel = Boolean(process.env.VERCEL);
const LEGACY_CATEGORY_KEYS = [
  'Operation Expenses',
  'Administration Expenses',
  'Financial Expenses',
  'Human Resources Expenses',
  'Depreciation & Amortization',
];

const client = mongoUri
  ? new MongoClient(mongoUri, {
      dbName,
    })
  : null;

let database;
let databaseInitPromise;

const sanitizeExpense = (expense) => {
  const sanitized = {
    expenseId: String(expense.expenseId || '').trim(),
    date: String(expense.date || '').trim(),
    taxYear: String(expense.taxYear || '').trim(),
    category: String(expense.category || '').trim(),
    subCategory: String(expense.subCategory || '').trim(),
    amount: Number(expense.amount),
    paymentMode: String(expense.paymentMode || '').trim(),
    vendorName: String(expense.vendorName || '').trim(),
    department: String(expense.department || '').trim(),
    employeeName: String(expense.employeeName || '').trim(),
    approvedBy: String(expense.approvedBy || '').trim(),
    invoiceNumber: String(expense.invoiceNumber || '').trim(),
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
};

const getDefaultCategorySelection = async () => {
  const document = await getCategoriesDocument();
  const availableCategories = Object.keys(document?.categories || {});
  const category = availableCategories[0] || '';
  return {
    category,
    subCategory: document?.categories?.[category]?.[0] || '',
  };
};

const cloneDefaultCategories = () => JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
const cloneDefaultDepartments = () => ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal', 'Customer Support'];
const shouldMigrateCategoryDocument = (categories = {}) =>
  Object.keys(categories).some((categoryName) => LEGACY_CATEGORY_KEYS.includes(categoryName));

const normalizeCategories = (categories) =>
  Object.fromEntries(
    Object.entries(categories)
      .map(([category, subCategories]) => [
        String(category).trim(),
        [...new Set((subCategories || []).map((subCategory) => String(subCategory).trim()).filter(Boolean))],
      ])
      .filter(([category]) => Boolean(category))
  );

const normalizeDepartments = (departments) =>
  [...new Set((departments || []).map((department) => String(department).trim()).filter(Boolean))];

const getExpensesCollection = () => database.collection('expenses');
const getCategoriesCollection = () => database.collection('settings');
const getUsersCollection = () => database.collection('users');

const seedDefaultSuperAdmin = async () => {
  const usersCollection = getUsersCollection();
  const superAdminCount = await usersCollection.countDocuments({ role: 'Super Admin' });
  if (superAdminCount === 0) {
    const adminLoginId = process.env.VITE_ADMIN_LOGIN_ID || 'iams_admin';
    const adminPassword = process.env.VITE_ADMIN_PASSWORD || 'N5@zK8!wC3#pR7$yT2';
    
    const existing = await usersCollection.findOne({ username: adminLoginId });
    if (!existing) {
      const salt = generateSalt();
      const passwordHash = hashPassword(adminPassword, salt);
      await usersCollection.insertOne({
        username: adminLoginId,
        passwordHash,
        salt,
        role: 'Super Admin',
        name: 'Super Admin User',
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Default Super Admin seeded: ${adminLoginId}`);
    }
  }
};

const initializeDatabase = async () => {
  if (database) {
    return database;
  }

  if (!mongoUri || !client) {
    throw new Error('Missing MONGO_URI in environment.');
  }

  if (!databaseInitPromise) {
    databaseInitPromise = (async () => {
      await client.connect();
      database = client.db(dbName);
      await getExpensesCollection().createIndex({ expenseId: 1 }, { unique: true });
      await getUsersCollection().createIndex({ username: 1 }, { unique: true });
      await seedDefaultSuperAdmin();
      await getCategoriesDocument();
      await getDepartmentsDocument();
      return database;
    })().catch((error) => {
      databaseInitPromise = undefined;
      throw error;
    });
  }

  return databaseInitPromise;
};

const getCategoriesDocument = async () => {
  const collection = getCategoriesCollection();
  const existing = await collection.findOne({ key: categoryDocumentKey });

  if (existing?.categories) {
    if (shouldMigrateCategoryDocument(existing.categories)) {
      const defaults = cloneDefaultCategories();
      await collection.updateOne(
        { key: categoryDocumentKey },
        {
          $set: {
            categories: defaults,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      return {
        ...existing,
        categories: defaults,
      };
    }

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

const getDepartmentsDocument = async () => {
  const collection = getCategoriesCollection();
  const existing = await collection.findOne({ key: departmentDocumentKey });

  if (Array.isArray(existing?.departments)) {
    return existing;
  }

  const defaults = cloneDefaultDepartments();
  const nextDocument = {
    key: departmentDocumentKey,
    departments: defaults,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await collection.updateOne(
    { key: departmentDocumentKey },
    { $set: nextDocument },
    { upsert: true }
  );

  return nextDocument;
};

const saveDepartmentsDocument = async (departments) => {
  const normalized = normalizeDepartments(departments);
  await getCategoriesCollection().updateOne(
    { key: departmentDocumentKey },
    {
      $set: {
        departments: normalized,
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

const getExpenseYear = (dateValue) => {
  const yearFromDate = Number.parseInt(String(dateValue || '').slice(0, 4), 10);
  return Number.isFinite(yearFromDate) ? yearFromDate : new Date().getFullYear();
};

const assignBulkExpenseIds = async (expenses) => {
  const years = [...new Set(
    expenses
      .filter((expense) => !expense.expenseId)
      .map((expense) => getExpenseYear(expense.date))
  )];

  const sequencesByYear = new Map(
    await Promise.all(
      years.map(async (year) => {
        const prefix = `EXP-${year}-`;
        const latestExpense = await getExpensesCollection()
          .find({ expenseId: { $regex: `^${prefix}` } })
          .sort({ expenseId: -1 })
          .limit(1)
          .next();
        const latestSequence = latestExpense
          ? Number.parseInt(String(latestExpense.expenseId).slice(prefix.length), 10) || 0
          : 0;

        return [year, latestSequence];
      })
    )
  );

  return expenses.map((expense) => {
    if (expense.expenseId) {
      return expense;
    }

    const year = getExpenseYear(expense.date);
    const nextSequence = (sequencesByYear.get(year) || 0) + 1;
    sequencesByYear.set(year, nextSequence);

    return {
      ...expense,
      expenseId: `EXP-${year}-${String(nextSequence).padStart(4, '0')}`,
    };
  });
};

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  next();
});

app.use('/api', async (_request, _response, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

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
    const defaultCategorySelection = await getDefaultCategorySelection();
    payload.expenseId = await getNextExpenseId(payload.date);
    if (!payload.date) {
      payload.date = new Date().toISOString().split('T')[0];
    }
    if (!payload.category) {
      payload.category = defaultCategorySelection.category;
    }
    if (!payload.subCategory) {
      payload.subCategory = defaultCategorySelection.subCategory;
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
    const defaultCategorySelection = await getDefaultCategorySelection();
    if (!payload.date) {
      payload.date = new Date().toISOString().split('T')[0];
    }
    if (!payload.category) {
      payload.category = defaultCategorySelection.category;
    }
    if (!payload.subCategory) {
      payload.subCategory = defaultCategorySelection.subCategory;
    }
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

    const defaultCategorySelection = await getDefaultCategorySelection();
    const sanitizedExpenses = entries.map((entry) => {
      const payload = sanitizeExpense(entry);
      if (!payload.date) {
        payload.date = new Date().toISOString().split('T')[0];
      }
      if (!payload.category) {
        payload.category = defaultCategorySelection.category;
      }
      if (!payload.subCategory) {
        payload.subCategory = defaultCategorySelection.subCategory;
      }
      assertExpense(payload);
      return payload;
    });

    const savedExpenses = await assignBulkExpenseIds(sanitizedExpenses);
    await getExpensesCollection().bulkWrite(
      savedExpenses.map((payload) => ({
        updateOne: {
          filter: { expenseId: payload.expenseId },
          update: { $set: payload },
          upsert: true,
        },
      })),
      { ordered: true }
    );

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

app.get('/api/categories/init', async (_request, response) => {
  const document = await getCategoriesDocument();
  response.json(document.categories);
});

app.post('/api/categories/init', async (_request, response) => {
  const document = await getCategoriesDocument();
  response.json(document.categories);
});

app.get('/api/departments', async (_request, response) => {
  const document = await getDepartmentsDocument();
  response.json(document.departments);
});

app.post('/api/departments', async (request, response) => {
  try {
    const departmentName = String(request.body?.departmentName || '').trim();
    if (!departmentName) {
      throw new Error('Department name is required');
    }

    const current = (await getDepartmentsDocument()).departments;
    if (current.includes(departmentName)) {
      throw new Error('Department already exists');
    }

    response.status(201).json(await saveDepartmentsDocument([...current, departmentName]));
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.put('/api/departments', async (request, response) => {
  try {
    const departments = Array.isArray(request.body?.departments) ? request.body.departments : [];
    response.json(await saveDepartmentsDocument(departments));
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

app.delete('/api/departments/:departmentName', async (request, response) => {
  const departmentName = request.params.departmentName;
  const current = (await getDepartmentsDocument()).departments;
  response.json(await saveDepartmentsDocument(current.filter((entry) => entry !== departmentName)));
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

app.put('/api/categories', async (request, response) => {
  try {
    const categories = request.body?.categories;
    if (!categories || typeof categories !== 'object' || Array.isArray(categories)) {
      throw new Error('Categories payload is required');
    }

    response.json(await saveCategoriesDocument(categories));
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

// Authentication and User Management Routes

app.post('/api/auth/login', async (request, response) => {
  try {
    const { username, password } = request.body || {};
    if (!username || !password) {
      response.status(400).json({ message: 'Username and password are required' });
      return;
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ username: username.trim() });
    if (!user) {
      response.status(401).json({ message: 'Invalid Login ID or Password. Please try again.' });
      return;
    }

    const hash = hashPassword(password.trim(), user.salt);
    if (hash !== user.passwordHash) {
      response.status(401).json({ message: 'Invalid Login ID or Password. Please try again.' });
      return;
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { sessionToken, updatedAt: new Date() } }
    );

    response.json({
      username: user.username,
      role: user.role,
      name: user.name,
      sessionToken,
      mustChangePassword: !!user.mustChangePassword
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/validate', async (request, response) => {
  try {
    const { username, sessionToken } = request.body || {};
    if (!username || !sessionToken) {
      response.status(400).json({ message: 'Username and session token are required' });
      return;
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ username: username.trim(), sessionToken });
    if (!user) {
      response.status(401).json({ message: 'Session is invalid or expired' });
      return;
    }

    response.json({
      username: user.username,
      role: user.role,
      name: user.name,
      sessionToken,
      mustChangePassword: !!user.mustChangePassword
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/change-password', async (request, response) => {
  try {
    const { username, sessionToken, currentPassword, newPassword } = request.body || {};
    if (!username || !sessionToken || !currentPassword || !newPassword) {
      response.status(400).json({ message: 'All fields are required' });
      return;
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ username: username.trim(), sessionToken });
    if (!user) {
      response.status(401).json({ message: 'Session is invalid or expired' });
      return;
    }

    const currentHash = hashPassword(currentPassword.trim(), user.salt);
    if (currentHash !== user.passwordHash) {
      response.status(400).json({ message: 'Incorrect current password' });
      return;
    }

    const newSalt = generateSalt();
    const newPasswordHash = hashPassword(newPassword.trim(), newSalt);

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newPasswordHash,
          salt: newSalt,
          mustChangePassword: false,
          updatedAt: new Date()
        }
      }
    );

    response.json({ message: 'Password changed successfully' });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/admins/change-password/:adminUsername', async (request, response) => {
  try {
    const { adminUsername } = request.params;
    const { username, token, newPassword } = request.body || {};

    if (!username || !token || !adminUsername || !newPassword) {
      response.status(400).json({ message: 'All fields are required' });
      return;
    }

    if (String(newPassword).trim().length < 6) {
      response.status(400).json({ message: 'Password must be at least 6 characters long' });
      return;
    }

    const usersCollection = getUsersCollection();
    const requester = await usersCollection.findOne({ username: username.trim(), sessionToken: token });
    if (!requester || requester.role !== 'Super Admin') {
      response.status(403).json({ message: 'Unauthorized' });
      return;
    }

    const targetUser = await usersCollection.findOne({ username: adminUsername.trim() });
    if (!targetUser) {
      response.status(404).json({ message: 'Administrator account not found' });
      return;
    }

    if (targetUser.role === 'Super Admin' && targetUser.username !== requester.username) {
      response.status(400).json({ message: 'You can only update your own Super Admin password' });
      return;
    }

    const newSalt = generateSalt();
    const newPasswordHash = hashPassword(newPassword.trim(), newSalt);
    const isSelfUpdate = targetUser.username === requester.username;

    await usersCollection.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          passwordHash: newPasswordHash,
          salt: newSalt,
          mustChangePassword: isSelfUpdate ? false : true,
          updatedAt: new Date()
        }
      }
    );

    response.json({
      message: isSelfUpdate
        ? 'Super Admin password updated successfully'
        : 'Admin password updated successfully. The admin must change it after next login.'
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/create-admin', async (request, response) => {
  try {
    const { username, sessionToken, adminUsername, adminPassword, adminName } = request.body || {};
    if (!username || !sessionToken || !adminUsername || !adminPassword || !adminName) {
      response.status(400).json({ message: 'All fields are required' });
      return;
    }

    const usersCollection = getUsersCollection();
    const requester = await usersCollection.findOne({ username: username.trim(), sessionToken });
    if (!requester || requester.role !== 'Super Admin') {
      response.status(403).json({ message: 'Unauthorized. Only Super Admins can create secondary admins.' });
      return;
    }

    const existing = await usersCollection.findOne({ username: adminUsername.trim() });
    if (existing) {
      response.status(400).json({ message: 'An account with this username/login ID already exists' });
      return;
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(adminPassword.trim(), salt);

    await usersCollection.insertOne({
      username: adminUsername.trim(),
      passwordHash,
      salt,
      role: 'Admin',
      name: adminName.trim(),
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    response.status(201).json({ message: 'Secondary admin account created successfully' });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/admins', async (request, response) => {
  try {
    const { username, token } = request.query;
    if (!username || !token) {
      response.status(400).json({ message: 'Missing parameters' });
      return;
    }

    const usersCollection = getUsersCollection();
    const requester = await usersCollection.findOne({ username: username.trim(), sessionToken: token });
    if (!requester || requester.role !== 'Super Admin') {
      response.status(403).json({ message: 'Unauthorized' });
      return;
    }

    const users = await usersCollection.find(
      {},
      { projection: { _id: 0, passwordHash: 0, salt: 0, sessionToken: 0 } }
    ).toArray();

    response.json(users);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/admins/delete/:adminUsername', async (request, response) => {
  try {
    const { adminUsername } = request.params;
    const { username, token } = request.body || {};
    
    if (!username || !token) {
      response.status(400).json({ message: 'Missing authorization details' });
      return;
    }

    const usersCollection = getUsersCollection();
    const requester = await usersCollection.findOne({ username: username.trim(), sessionToken: token });
    if (!requester || requester.role !== 'Super Admin') {
      response.status(403).json({ message: 'Unauthorized' });
      return;
    }

    if (adminUsername === requester.username) {
      response.status(400).json({ message: 'You cannot delete your own Super Admin account' });
      return;
    }

    const targetUser = await usersCollection.findOne({ username: adminUsername });
    if (targetUser && targetUser.role === 'Super Admin') {
      response.status(400).json({ message: 'Cannot delete a Super Admin account' });
      return;
    }

    const result = await usersCollection.deleteOne({ username: adminUsername });
    response.json({ success: result.deletedCount > 0 });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.use((error, _request, response, _next) => {
  response.status(500).json({ message: error.message || 'Unexpected server error' });
});

const start = async () => {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`Mongo API listening on http://localhost:${port} using database "${dbName}"`);
  });
};

if (!isVercel) {
  start().catch((error) => {
    console.error('Failed to start Mongo API:', error);
    process.exit(1);
  });
}

export default app;
