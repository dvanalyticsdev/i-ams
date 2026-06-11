import { apiRequest } from './api';
import { DEFAULT_EXPENSE_CATEGORIES } from './categoryDefaults';

export const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal', 'Customer Support'];

export const PAYMENT_MODES = ['Card', 'Net Banking', 'UPI', 'Cash'];

const CATEGORY_STORAGE_KEY = 'iams_expense_categories';

const readCategoryCache = () => {
  if (typeof window === 'undefined') {
    return JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  }

  const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
  if (!raw) {
    return JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  }

  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  }
};

const writeCategoryCache = (categories) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  }
  return categories;
};

export const initializeExpenseCategories = async () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CATEGORY_STORAGE_KEY);
  }

  const categories = await apiRequest('/categories');
  return writeCategoryCache(categories);
};

export const getExpenseCategories = () => readCategoryCache();

export const addExpenseCategory = async (categoryName) => {
  const categories = await apiRequest('/categories', {
    method: 'POST',
    body: JSON.stringify({ categoryName }),
  });
  return writeCategoryCache(categories);
};

export const removeExpenseCategory = async (categoryName) => {
  const categories = await apiRequest(`/categories/${encodeURIComponent(categoryName)}`, {
    method: 'DELETE',
  });
  return writeCategoryCache(categories);
};

export const addExpenseSubCategory = async (categoryName, subCategoryName) => {
  const categories = await apiRequest(`/categories/${encodeURIComponent(categoryName)}/subcategories`, {
    method: 'POST',
    body: JSON.stringify({ subCategoryName }),
  });
  return writeCategoryCache(categories);
};

export const removeExpenseSubCategory = async (categoryName, subCategoryName) => {
  const categories = await apiRequest(
    `/categories/${encodeURIComponent(categoryName)}/subcategories/${encodeURIComponent(subCategoryName)}`,
    {
      method: 'DELETE',
    }
  );
  return writeCategoryCache(categories);
};
