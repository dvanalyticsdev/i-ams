import { apiRequest } from './api';
import { DEFAULT_EXPENSE_CATEGORIES } from './categoryDefaults';

export const DEFAULT_DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Legal', 'Customer Support'];
export const PAYMENT_MODES = ['Card', 'Net Banking', 'UPI', 'Cash'];

const CATEGORY_STORAGE_KEY = 'iams_expense_categories';
const DEPARTMENT_STORAGE_KEY = 'iams_expense_departments';

const cloneDefaultCategories = () => JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
const cloneDefaultDepartments = () => [...DEFAULT_DEPARTMENTS];

const readStorageJson = (key, fallbackFactory) => {
  if (typeof window === 'undefined') {
    return fallbackFactory();
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallbackFactory();
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallbackFactory();
  }
};

const writeStorageJson = (key, value) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  return value;
};

const readCategoryCache = () => readStorageJson(CATEGORY_STORAGE_KEY, cloneDefaultCategories);
const writeCategoryCache = (categories) => writeStorageJson(CATEGORY_STORAGE_KEY, categories);

const readDepartmentCache = () => readStorageJson(DEPARTMENT_STORAGE_KEY, cloneDefaultDepartments);
const writeDepartmentCache = (departments) => writeStorageJson(DEPARTMENT_STORAGE_KEY, departments);

export const initializeExpenseCategories = async () => {
  try {
    const categories = await apiRequest('/categories');
    return writeCategoryCache(categories);
  } catch {
    // API unavailable – return cached categories or built-in defaults
    return readCategoryCache();
  }
};

export const initializeDepartments = async () => {
  try {
    const departments = await apiRequest('/departments');
    return writeDepartmentCache(departments);
  } catch {
    // API unavailable – return cached departments or built-in defaults
    return readDepartmentCache();
  }
};

export const getExpenseCategories = () => readCategoryCache();
export const getDepartments = () => readDepartmentCache();

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

export const addDepartment = async (departmentName) => {
  const departments = await apiRequest('/departments', {
    method: 'POST',
    body: JSON.stringify({ departmentName }),
  });

  return writeDepartmentCache(departments);
};

export const removeDepartment = async (departmentName) => {
  const departments = await apiRequest(`/departments/${encodeURIComponent(departmentName)}`, {
    method: 'DELETE',
  });

  return writeDepartmentCache(departments);
};

export const syncExpenseCategories = async (categories) => {
  const normalized = Object.fromEntries(
    Object.entries(categories || {})
      .map(([categoryName, subCategories]) => [
        String(categoryName).trim(),
        [...new Set((subCategories || []).map((subCategory) => String(subCategory).trim()).filter(Boolean))],
      ])
      .filter(([categoryName]) => Boolean(categoryName))
  );

  try {
    const saved = await apiRequest('/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories: normalized }),
    });
    return writeCategoryCache(saved);
  } catch {
    return writeCategoryCache(normalized);
  }
};

export const syncDepartments = async (departments) => {
  const normalized = [...new Set((departments || []).map((department) => String(department).trim()).filter(Boolean))];

  try {
    const saved = await apiRequest('/departments', {
      method: 'PUT',
      body: JSON.stringify({ departments: normalized }),
    });
    return writeDepartmentCache(saved);
  } catch {
    return writeDepartmentCache(normalized);
  }
};
