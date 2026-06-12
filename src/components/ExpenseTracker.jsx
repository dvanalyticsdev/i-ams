import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Eye, 
  Download, 
  Upload,
  X, 
  Calendar, 
  IndianRupee, 
  Briefcase, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  FileText,
  AlertCircle,
  Activity,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { initializeDB, getExpenses, saveExpense, saveExpensesBulk, deleteExpense, deleteExpensesByImportBatch } from '../services/expenseService';
import { DEFAULT_DEPARTMENTS, PAYMENT_MODES } from '../services/categories';

function ExpenseTracker({ categories, departments, showToast }) {
  // Database state
  const [expenses, setExpenses] = useState([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingImportBatchId, setDeletingImportBatchId] = useState('');
  
  // Active selected items for modals
  const [selectedExpense, setSelectedExpense] = useState(null);
  const importInputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [formData, setFormData] = useState({
    expenseId: '',
    date: '',
    category: '',
    subCategory: '',
    amount: '',
    invoiceNumber: '',
    paymentMode: 'Card',
    vendorName: '',
    department: DEFAULT_DEPARTMENTS[0],
    employeeName: '',
    description: '',
    attachment: ''
  });

  // Load expenses on mount
  useEffect(() => {
    void refreshExpenses();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const availableCategories = Object.keys(categories);
  const availableDepartments = departments.length ? departments : DEFAULT_DEPARTMENTS;
  const formatDateForInput = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const formatDateTimeForDisplay = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  const getDefaultCategorySelection = () => {
    const firstCategory = availableCategories[0] || '';
    return {
      category: firstCategory,
      subCategory: categories[firstCategory]?.[0] || ''
    };
  };
  const getTodayDate = () => formatDateForInput(new Date());

  useEffect(() => {
    if (filterCategory && !categories[filterCategory]) {
      setFilterCategory('');
      setFilterSubCategory('');
    } else if (filterSubCategory && filterCategory && !categories[filterCategory]?.includes(filterSubCategory)) {
      setFilterSubCategory('');
    }

    if (filterDept && !availableDepartments.includes(filterDept)) {
      setFilterDept('');
    }

    setFormData((prev) => {
      if (!availableCategories.length) {
        return {
          ...prev,
          category: '',
          subCategory: ''
        };
      }

      if (!prev.category || !categories[prev.category]) {
        return {
          ...prev,
          ...getDefaultCategorySelection()
        };
      }

      if (prev.subCategory && categories[prev.category]?.includes(prev.subCategory)) {
        if (prev.department && availableDepartments.includes(prev.department)) {
          return prev;
        }

        return {
          ...prev,
          department: availableDepartments[0] || ''
        };
      }

      return {
        ...prev,
        subCategory: categories[prev.category]?.[0] || '',
        department: availableDepartments.includes(prev.department) ? prev.department : (availableDepartments[0] || '')
      };
    });
  }, [availableDepartments, categories, filterCategory, filterSubCategory, filterDept]);

  const refreshExpenses = async () => {
    const nextExpenses = await initializeDB();
    setExpenses(nextExpenses);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm, filterCategory, filterSubCategory, filterDept, 
    filterMinAmount, filterMaxAmount, filterStartDate, filterEndDate
  ]);

  // Handle Sort Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterCategory('');
    setFilterSubCategory('');
    setFilterDept('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterStartDate('');
    setFilterEndDate('');
    showToast("All filters cleared", "success");
  };

  // Dynamic filter processing
  const getFilteredExpenses = () => {
    return expenses.filter(item => {
      // Search term (Matches Name, ID, Vendor, Description)
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesId = item.expenseId.toLowerCase().includes(term);
        const matchesInvoice = String(item.invoiceNumber || '').toLowerCase().includes(term);
        const matchesEmployee = item.employeeName.toLowerCase().includes(term);
        const matchesVendor = item.vendorName.toLowerCase().includes(term);
        const matchesDesc = item.description.toLowerCase().includes(term);
        if (!matchesId && !matchesInvoice && !matchesEmployee && !matchesVendor && !matchesDesc) {
          return false;
        }
      }

      // Categories
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterSubCategory && item.subCategory !== filterSubCategory) return false;

      // Department
      if (filterDept && item.department !== filterDept) return false;

      // Amount Range
      if (filterMinAmount && item.amount < parseFloat(filterMinAmount)) return false;
      if (filterMaxAmount && item.amount > parseFloat(filterMaxAmount)) return false;

      // Date Range
      if (filterStartDate && new Date(item.date) < new Date(filterStartDate)) return false;
      if (filterEndDate && new Date(item.date) > new Date(filterEndDate)) return false;

      return true;
    });
  };

  // Dynamic sorting processing
  const getSortedExpenses = (filteredList) => {
    return [...filteredList].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (sortField === 'amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredItems = getFilteredExpenses();
  const sortedItems = getSortedExpenses(filteredItems);

  // Pagination Math
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedItems.slice(indexOfFirstRow, indexOfLastRow);

  // Filtered Summary Cards calculations (Simplified)
  const summaryTotalAmount = filteredItems.reduce((sum, e) => sum + e.amount, 0);
  const summaryCount = filteredItems.length;
  const summaryAvgAmount = summaryCount > 0 ? summaryTotalAmount / summaryCount : 0;
  const summaryMaxAmount = summaryCount > 0 ? filteredItems.reduce((max, e) => Math.max(max, e.amount), 0) : 0;
  const importedBatches = Object.values(
    expenses.reduce((acc, expense) => {
      if (!expense.importBatchId) {
        return acc;
      }

      if (!acc[expense.importBatchId]) {
        acc[expense.importBatchId] = {
          importBatchId: expense.importBatchId,
          importFileName: expense.importFileName || 'Imported file',
          importedAt: expense.importedAt || '',
          count: 0
        };
      }

      acc[expense.importBatchId].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0));

  // Open Form Modal (Add)
  const handleAddClick = () => {
    if (!availableCategories.length) {
      showToast("Create a category before adding an expense", "warning");
      return;
    }

    const defaultCategorySelection = getDefaultCategorySelection();
    setFormData({
      expenseId: '',
      date: getTodayDate(),
      ...defaultCategorySelection,
      amount: '',
      invoiceNumber: '',
      paymentMode: PAYMENT_MODES[0],
      vendorName: '',
      department: availableDepartments[0],
      employeeName: '',
      description: '',
      attachment: ''
    });
    setSelectedExpense(null);
    setFormModalOpen(true);
  };

  // Open Form Modal (Edit)
  const handleEditClick = (expense, e) => {
    e.stopPropagation();
    setFormData({
      expenseId: expense.expenseId,
      date: expense.date,
      category: expense.category,
      subCategory: expense.subCategory,
      amount: expense.amount,
      invoiceNumber: expense.invoiceNumber || '',
      paymentMode: expense.paymentMode,
      vendorName: expense.vendorName,
      department: expense.department,
      employeeName: expense.employeeName,
      description: expense.description,
      attachment: expense.attachment || ''
    });
    setSelectedExpense(expense);
    setFormModalOpen(true);
  };

  // Open Details Modal
  const handleViewClick = (expense) => {
    setSelectedExpense(expense);
    setDetailsModalOpen(true);
  };

  // Delete Click handler
  const handleDeleteClick = (expense, e) => {
    e.stopPropagation();
    setSelectedExpense(expense);
    setDeleteConfirmOpen(true);
  };

  // Delete confirm action
  const confirmDelete = async () => {
    if (selectedExpense) {
      await deleteExpense(selectedExpense.expenseId);
      await refreshExpenses();
      setDeleteConfirmOpen(false);
      setSelectedExpense(null);
      showToast("Expense record deleted successfully", "success");
    }
  };

  // Form Field change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'category') {
      const subcats = categories[value] || [];
      setFormData(prev => ({
        ...prev,
        category: value,
        subCategory: subcats[0] || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setFormData((prev) => ({
        ...prev,
        attachment: ''
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      attachment: file.name
    }));
  };

  // Form Submit handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!availableCategories.length) {
      showToast("Add at least one category before creating expenses", "warning");
      return;
    }
    
    if (parseFloat(formData.amount) <= 0 || isNaN(parseFloat(formData.amount))) {
      showToast("Amount must be a positive number", "warning");
      return;
    }
    const defaultCategorySelection = getDefaultCategorySelection();

    const payload = {
      ...formData,
      date: formData.date || getTodayDate(),
      category: formData.category || defaultCategorySelection.category,
      subCategory: formData.subCategory || defaultCategorySelection.subCategory,
      paymentMode: formData.paymentMode || PAYMENT_MODES[0],
      department: formData.department || availableDepartments[0],
      invoiceNumber: formData.invoiceNumber.trim(),
      vendorName: formData.vendorName.trim(),
      employeeName: formData.employeeName.trim(),
      description: formData.description.trim(),
      amount: parseFloat(formData.amount)
    };

    await saveExpense(payload);
    await refreshExpenses();
    setFormModalOpen(false);
    
    const isEdit = !!formData.expenseId;
    showToast(
      isEdit 
        ? `Expense ${formData.expenseId} updated successfully` 
        : "New expense record added successfully",
      "success"
    );
  };

  const getExportRows = () => {
    return filteredItems.map((expense) => ({
      'Expense ID': expense.expenseId,
      'Invoice Number': expense.invoiceNumber || '',
      Date: expense.date,
      Category: expense.category,
      'Sub-Category': expense.subCategory,
      Amount: expense.amount,
      'Payment Mode': expense.paymentMode,
      'Vendor Name': expense.vendorName,
      Department: expense.department,
      'Employee Name': expense.employeeName,
      Description: expense.description,
      Attachment: expense.attachment || ''
    }));
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Filtered items to CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      showToast("No data available to export", "warning");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(getExportRows());
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `iams_expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    setExportMenuOpen(false);
    showToast("Downloaded CSV report successfully", "success");
  };

  const handleExportXLSX = () => {
    if (filteredItems.length === 0) {
      showToast("No data available to export", "warning");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(getExportRows());
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    XLSX.writeFile(workbook, `iams_expenses_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    setExportMenuOpen(false);
    showToast("Downloaded XLSX report successfully", "success");
  };

  const normalizeHeader = (header) => String(header).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const monthHeaderPattern = /^[A-Za-z]{3}\/\d{2}$/;
  const hasAnyHeader = (headers, aliases) => aliases.some((alias) => headers.includes(alias));
  const buildNormalizedCategoryMaps = () => {
    const normalizedCategoryLookup = new Map();
    const normalizedSubCategoryLookup = new Map();

    Object.entries(categories).forEach(([categoryName, subCategoryList]) => {
      normalizedCategoryLookup.set(normalizeHeader(categoryName), categoryName);
      (subCategoryList || []).forEach((subCategoryName) => {
        normalizedSubCategoryLookup.set(normalizeHeader(subCategoryName), {
          category: categoryName,
          subCategory: subCategoryName
        });
      });
    });

    return {
      normalizedCategoryLookup,
      normalizedSubCategoryLookup
    };
  };

  const resolveDateValue = (value) => {
    if (!value) {
      return '';
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatDateForInput(value);
    }

    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDateForInput(parsedDate);
    }

    return '';
  };

  const resolveMonthHeaderDate = (header) => {
    const [monthName, yearSuffix] = String(header).trim().split('/');
    const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      .indexOf(monthName.toLowerCase());

    if (monthIndex === -1) {
      return '';
    }

    const fullYear = 2000 + Number.parseInt(yearSuffix, 10);
    if (Number.isNaN(fullYear)) {
      return '';
    }

    return `${fullYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  };

  const resolveCategoryEntry = (label, fallbackCategory = '') => {
    const { normalizedCategoryLookup, normalizedSubCategoryLookup } = buildNormalizedCategoryMaps();
    const normalizedLabel = normalizeHeader(label);

    if (normalizedSubCategoryLookup.has(normalizedLabel)) {
      return normalizedSubCategoryLookup.get(normalizedLabel);
    }

    if (normalizedCategoryLookup.has(normalizedLabel)) {
      const category = normalizedCategoryLookup.get(normalizedLabel);
      return {
        category,
        subCategory: categories[category]?.[0] || ''
      };
    }

    return {
      category: fallbackCategory || getDefaultCategorySelection().category,
      subCategory: String(label || '').trim()
    };
  };

  const isLeafDetailLabel = (label) => /^\s*[0-9-]/.test(label);
  const cleanLeafDetailLabel = (label) => String(label).replace(/^\s*[0-9-]+/, '').trim();
  const isPlaceholderMonthlyRow = (values) => {
    const positiveValues = values.filter((value) => Number.isFinite(value) && value > 0);
    if (!positiveValues.length) {
      return true;
    }

    return positiveValues.every((value) => value <= 0.01);
  };

  const createExpensesFromMonthlyRow = ({
    row,
    sheetName,
    category,
    subCategory,
    vendorName = '',
    employeeName = ''
  }) => {
    const expensesFromRow = [];
    const monthEntries = Object.entries(row).filter(([header]) => monthHeaderPattern.test(String(header).trim()));
    const isFacultyFee = normalizeHeader(subCategory).startsWith('facultyfees');

    const monthlyValues = monthEntries
      .map(([, value]) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (isPlaceholderMonthlyRow(monthlyValues)) {
      return expensesFromRow;
    }

    monthEntries.forEach(([header, rawValue]) => {
      const amount = Number(rawValue);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      expensesFromRow.push({
        expenseId: '',
        date: resolveMonthHeaderDate(header) || getTodayDate(),
        category,
        subCategory,
        amount,
        invoiceNumber: '',
        paymentMode: PAYMENT_MODES[0],
        vendorName: isFacultyFee ? '' : vendorName,
        department: availableDepartments[0],
        employeeName: isFacultyFee ? (employeeName || vendorName) : employeeName,
        description: `Imported from ${sheetName} - ${String(header).trim()}`,
        attachment: ''
      });
    });

    return expensesFromRow;
  };

  const mapConsolidatedPLSheet = (rows, sheetName) => {
    const currentCategories = buildNormalizedCategoryMaps().normalizedCategoryLookup;
    const startIndex = rows.findIndex((row) => normalizeHeader(row.__EMPTY) === 'expenditure');
    if (startIndex === -1) {
      return [];
    }

    const expensesFromSheet = [];
    let currentCategory = '';
    let pendingParent = null;
    let pendingParentHasChildren = false;

    const flushPendingParent = () => {
      if (pendingParent && !pendingParentHasChildren) {
        expensesFromSheet.push(
          ...createExpensesFromMonthlyRow({
            row: pendingParent.row,
            sheetName,
            category: pendingParent.category,
            subCategory: pendingParent.subCategory
          })
        );
      }

      pendingParent = null;
      pendingParentHasChildren = false;
    };

    for (let index = startIndex + 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rawLabel = String(row.__EMPTY || '').trimEnd();
      const trimmedLabel = rawLabel.trim();
      const normalizedLabel = normalizeHeader(trimmedLabel);

      if (!trimmedLabel) {
        flushPendingParent();
        continue;
      }

      if (['netprofit', 'ebitda', 'ebitdapercentage', 'ebit', 'ebitpercentage'].includes(normalizedLabel)) {
        flushPendingParent();
        break;
      }

      if (currentCategories.has(normalizedLabel)) {
        flushPendingParent();
        currentCategory = currentCategories.get(normalizedLabel);
        continue;
      }

      if (!currentCategory) {
        continue;
      }

      if (isLeafDetailLabel(rawLabel)) {
        if (!pendingParent) {
          continue;
        }

        pendingParentHasChildren = true;
        const detailName = cleanLeafDetailLabel(rawLabel);
        expensesFromSheet.push(
          ...createExpensesFromMonthlyRow({
            row,
            sheetName,
            category: pendingParent.category,
            subCategory: pendingParent.subCategory,
            vendorName: detailName,
            employeeName: ''
          })
        );
        continue;
      }

      flushPendingParent();
      const resolvedEntry = resolveCategoryEntry(trimmedLabel, currentCategory);
      pendingParent = {
        row,
        category: resolvedEntry.category || currentCategory,
        subCategory: resolvedEntry.subCategory || trimmedLabel
      };
    }

    flushPendingParent();
    return expensesFromSheet;
  };

  const parseWorkbookExpenses = (workbook) => {
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) {
        continue;
      }

      const normalizedHeaders = Object.keys(rows[0] || {}).map(normalizeHeader);
      const hasFlatExpenseShape =
        hasAnyHeader(normalizedHeaders, ['amount', 'expensesamount']) &&
        hasAnyHeader(normalizedHeaders, ['category', 'expensescategory']);
      if (hasFlatExpenseShape) {
        return rows.map(mapImportedRow);
      }

      const consolidatedExpenses = mapConsolidatedPLSheet(rows, sheetName);
      if (consolidatedExpenses.length) {
        return consolidatedExpenses;
      }
    }

    throw new Error('No importable sheet found in workbook');
  };

  const mapImportedRow = (row) => {
    const normalizedRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
    );

    const defaultCategorySelection = getDefaultCategorySelection();
    const rawCategory = String(
      normalizedRow.category ||
      normalizedRow.expensescategory ||
      normalizedRow.maincategorydepartment ||
      ''
    ).trim();
    const rawSubCategory = String(
      normalizedRow.subcategory ||
      normalizedRow.expensessubcategory ||
      normalizedRow.subcategories ||
      ''
    ).trim();
    const resolvedCategoryEntry = rawSubCategory
      ? resolveCategoryEntry(rawSubCategory, rawCategory || defaultCategorySelection.category)
      : resolveCategoryEntry(rawCategory, defaultCategorySelection.category);
    const category = resolvedCategoryEntry.category || defaultCategorySelection.category;
    const availableSubCategories = categories[category] || [];
    const subCategory = rawSubCategory
      ? (resolvedCategoryEntry.subCategory || rawSubCategory)
      : (availableSubCategories[0] || resolvedCategoryEntry.subCategory || defaultCategorySelection.subCategory);
    const amount = parseFloat(normalizedRow.amount ?? normalizedRow.expensesamount);
    const invoiceNumber = String(
      normalizedRow.invoicenumber ||
      normalizedRow.invoiceno ||
      normalizedRow.invoicenum ||
      normalizedRow.invoice ||
      ''
    ).trim();
    const paymentMode = String(normalizedRow.paymentmode || normalizedRow.mode || PAYMENT_MODES[0]).trim();
    const department = String(normalizedRow.department || normalizedRow.dept || availableDepartments[0]).trim();
    const vendorName = String(normalizedRow.vendorname || normalizedRow.vendor || '').trim();
    const employeeName = String(
      normalizedRow.employeename ||
      normalizedRow.employee ||
      normalizedRow.expensesby ||
      ''
    ).trim();
    const approvedBy = String(normalizedRow.approvedby || '').trim();
    const description = String(normalizedRow.description || '').trim();

    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const resolvedDate = resolveDateValue(normalizedRow.date);

    return {
      expenseId: String(normalizedRow.expenseid || normalizedRow.id || '').trim(),
      date: resolvedDate || getTodayDate(),
      category,
      subCategory,
      amount,
      invoiceNumber,
      paymentMode: PAYMENT_MODES.includes(paymentMode) ? paymentMode : PAYMENT_MODES[0],
      vendorName,
      department: availableDepartments.includes(department) ? department : availableDepartments[0],
      employeeName,
      description: approvedBy
        ? `${description}${description ? ' ' : ''}Approved By: ${approvedBy}`
        : description,
      attachment: String(normalizedRow.attachment || '').trim()
    };
  };

  const handleImportClick = () => {
    if (isImporting) {
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const parsedExpenses = parseWorkbookExpenses(workbook);
      if (!parsedExpenses.length) {
        showToast('Import file does not contain any importable expense rows', 'warning');
        return;
      }

      const nextExpenses = await saveExpensesBulk(parsedExpenses, {
        importBatchId: `import-${Date.now()}`,
        importFileName: file.name,
        importedAt: new Date().toISOString()
      });
      setExpenses(nextExpenses);
      setCurrentPage(1);
      showToast(`Imported ${parsedExpenses.length} expense record(s) successfully`, 'success');
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'warning');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const handleDeleteImportedBatch = async (batch) => {
    const confirmed = window.confirm(`Delete all ${batch.count} records imported from ${batch.importFileName}?`);
    if (!confirmed) {
      return;
    }

    setDeletingImportBatchId(batch.importBatchId);
    try {
      const removedCount = await deleteExpensesByImportBatch(batch.importBatchId);
      setExpenses(getExpenses());
      setCurrentPage(1);
      showToast(`Deleted ${removedCount} imported record(s) from ${batch.importFileName}`, 'success');
    } catch (error) {
      showToast(`Delete failed: ${error.message}`, 'warning');
    } finally {
      setDeletingImportBatchId('');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const sortIndicator = (field) => {
    if (sortField !== field) {
      return '';
    }

    return sortDirection === 'asc' ? ' ^' : ' v';
  };

  return (
    <div className="panel-stack">
      
      {/* SUMMARY PANEL CARD ROW (Modified) */}
      <div className="grid-4">
        <div className="card metric-card" style={{ '--metric-accent': 'var(--primary)', '--metric-soft': 'var(--primary-soft)' }}>
          <div className="metric-icon">
            <TrendingUp size={16} />
          </div>
          <div>
            <div className="metric-label">Filtered Spend</div>
            <div className="metric-value">{formatCurrency(summaryTotalAmount)}</div>
          </div>
        </div>

        <div className="card metric-card" style={{ '--metric-accent': 'var(--secondary)', '--metric-soft': 'rgba(59, 130, 246, 0.08)' }}>
          <div className="metric-icon">
            <Activity size={16} />
          </div>
          <div>
            <div className="metric-label">Transactions Count</div>
            <div className="metric-value">{summaryCount} Items</div>
          </div>
        </div>

        <div className="card metric-card" style={{ '--metric-accent': 'var(--success)', '--metric-soft': 'var(--success-soft)' }}>
          <div className="metric-icon">
            <IndianRupee size={16} />
          </div>
          <div>
            <div className="metric-label">Average Transaction</div>
            <div className="metric-value">{formatCurrency(summaryAvgAmount)}</div>
          </div>
        </div>

        <div className="card metric-card" style={{ '--metric-accent': 'var(--danger)', '--metric-soft': 'var(--danger-soft)' }}>
          <div className="metric-icon">
            <Award size={16} />
          </div>
          <div>
            <div className="metric-label">Highest Expense</div>
            <div className="metric-value">{formatCurrency(summaryMaxAmount)}</div>
          </div>
        </div>
      </div>

      <div className="card panel-stack" style={{ gap: '12px' }}>
        <div className="card-header">
          <div>
            <h3 className="section-title">Imported Files</h3>
            <div className="section-copy">
              Remove a specific import batch without clearing the whole ledger.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {importedBatches.length === 0 ? (
            <div className="empty-state">
              No tracked import batches yet. Import a new CSV or XLSX file from this screen and its delete action will appear here.
            </div>
          ) : (
            importedBatches.map((batch) => (
              <div
                key={batch.importBatchId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface)'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{batch.importFileName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    {batch.count} records imported
                    {batch.importedAt ? ` on ${formatDateTimeForDisplay(batch.importedAt)}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDeleteImportedBatch(batch)}
                  disabled={deletingImportBatchId === batch.importBatchId}
                  style={{ fontSize: '12px' }}
                >
                  <Trash2 size={14} />
                  {deletingImportBatchId === batch.importBatchId ? 'Deleting...' : 'Delete Import'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SEARCH & FILTERS GRID */}
      <div className="card filter-panel">
        <div className="filter-toolbar">
          <div className="input-with-icon toolbar-search">
            <input 
              type="text" 
              placeholder="Search ID, employee, vendor..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search size={14} />
          </div>

          <div className="toolbar-actions">
            <button className="btn btn-secondary btn-compact" onClick={handleClearFilters}>
              Reset Filters
            </button>
            <div style={{ position: 'relative' }} ref={exportMenuRef}>
              <button
                className="btn btn-secondary btn-compact"
                onClick={() => setExportMenuOpen((prev) => !prev)}
              >
                <Download size={14} />
                Export
              </button>
              {exportMenuOpen && (
                <div className="menu-panel" role="menu">
                  <button className="menu-item" onClick={handleExportCSV} role="menuitem">
                    CSV Format
                  </button>
                  <button className="menu-item" onClick={handleExportXLSX} role="menuitem">
                    XLSX Format
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary btn-compact"
              onClick={handleImportClick}
              disabled={isImporting}
            >
              <Upload size={14} />
              {isImporting ? 'Importing...' : 'Import CSV/XLSX'}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
            <button className="btn btn-primary btn-compact" onClick={handleAddClick}>
              <Plus size={14} />
              Add Expense
            </button>
          </div>
        </div>

        {/* Advanced filters inputs row */}
        <div className="filter-grid">
          {/* Category Filter */}
          <div>
            <label>Category</label>
            <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(''); }}>
              <option value="">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Sub-Category Filter */}
          <div>
            <label>Sub-Category</label>
            <select 
              value={filterSubCategory} 
              onChange={e => setFilterSubCategory(e.target.value)}
              disabled={!filterCategory}
            >
              <option value="">All Sub-Categories</option>
              {filterCategory && categories[filterCategory]?.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label>Department</label>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Min Amount Filter */}
          <div>
            <label>Min Amount</label>
            <input 
              type="number" 
              placeholder="Min ₹" 
              value={filterMinAmount} 
              onChange={e => setFilterMinAmount(e.target.value)} 
            />
          </div>

          {/* Max Amount Filter */}
          <div>
            <label>Max Amount</label>
            <input 
              type="number" 
              placeholder="Max ₹" 
              value={filterMaxAmount} 
              onChange={e => setFilterMaxAmount(e.target.value)} 
            />
          </div>

          {/* Start Date Filter */}
          <div>
            <label>From Date</label>
            <input 
              type="date" 
              value={filterStartDate} 
              onChange={e => setFilterStartDate(e.target.value)} 
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label>To Date</label>
            <input 
              type="date" 
              value={filterEndDate} 
              onChange={e => setFilterEndDate(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="table-shell">
        <div className="table-toolbar">
          <div>
            <h3 className="section-title">Expense Records</h3>
            <div className="table-meta">{totalItems} matching entries</div>
          </div>
        </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('expenseId')} style={{ cursor: 'pointer' }}>
                ID {sortField === 'expenseId' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left">Invoice No.</th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                Date {sortField === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="text-left">Employee</th>
              <th className="text-left">Category</th>
              <th className="text-left">Sub-Category</th>
              <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                Amount {sortField === 'amount' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th>Mode</th>
              <th className="text-left">Vendor</th>
              <th>Dept</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ padding: '40px', color: 'var(--text-muted)' }}>
                  <AlertCircle size={32} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)' }} />
                  No matching expense claims found in this directory.
                </td>
              </tr>
            ) : (
              currentRows.map((row) => (
                <tr key={row.expenseId} onClick={() => handleViewClick(row)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.expenseId}</td>
                  <td className="text-left" style={{ fontFamily: 'monospace' }}>{row.invoiceNumber || '-'}</td>
                  <td>{row.date}</td>
                  <td className="text-left" style={{ fontWeight: 600 }}>{row.employeeName}</td>
                  <td className="text-left" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.category}</td>
                  <td className="text-left" style={{ fontWeight: 500 }}>{row.subCategory}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(row.amount)}</td>
                  <td>{row.paymentMode}</td>
                  <td className="text-left" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.vendorName}
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: '2px' }}>
                      {row.department}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-ghost" 
                        onClick={(e) => { e.stopPropagation(); handleViewClick(row); }}
                        style={{ padding: '4px', color: 'var(--text-muted)' }}
                        title="View Details"
                      >
                        <Eye size={13} />
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        onClick={(e) => handleEditClick(row, e)}
                        style={{ padding: '4px', color: 'var(--text-muted)' }}
                        title="Edit Record"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        onClick={(e) => handleDeleteClick(row, e)}
                        style={{ padding: '4px', color: 'var(--danger)' }}
                        title="Delete Record"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        </div>

        {/* PAGINATION PANEL */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <div className="pagination-summary">
              Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, totalItems)} of {totalItems} entries
            </div>

            <div className="pagination-controls">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rows per page:</span>
                <select 
                  value={rowsPerPage} 
                  onChange={e => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                  style={{ width: '60px', padding: '3px 6px', fontSize: '11px', height: '24px' }}
                >
                  {[10, 25, 50].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="pagination-pages">
                <button 
                  className="btn btn-secondary btn-compact" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ padding: '4px 8px', height: '26px' }}
                >
                  <ChevronLeft size={14} />
                </button>
                
                {[...Array(totalPages)].map((_, idx) => (
                  <button 
                    key={idx}
                    className={`btn btn-compact ${currentPage === idx + 1 ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCurrentPage(idx + 1)}
                    style={{
                      padding: '4px 10px',
                      height: '26px',
                      fontSize: '12px',
                      backgroundColor: currentPage === idx + 1 ? 'var(--primary)' : 'var(--surface)',
                      color: currentPage === idx + 1 ? '#ffffff' : 'var(--text)',
                      borderColor: currentPage === idx + 1 ? 'var(--primary)' : 'var(--border-strong)'
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}

                <button 
                  className="btn btn-secondary btn-compact" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ padding: '4px 8px', height: '26px' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM MODAL */}
      {formModalOpen && (
        <div className="dialog-backdrop">
          <div className="card dialog-card" role="dialog" aria-modal="true" aria-label={selectedExpense ? `Edit ${formData.expenseId}` : 'New accounting entry'}>
            <button 
              onClick={() => setFormModalOpen(false)}
              className="dialog-close"
            >
              <X size={18} />
            </button>

            <div className="dialog-header">
              <h2 className="dialog-title">
                {selectedExpense ? `Edit Ledger Claim (${formData.expenseId})` : 'New Accounting Entry'}
              </h2>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>Date</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={formData.date} 
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label>Amount (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="amount" 
                    value={formData.amount} 
                    onChange={handleFormChange}
                    placeholder="Enter amount"
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleFormChange} disabled={!availableCategories.length}>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Sub-Category</label>
                  <select name="subCategory" value={formData.subCategory} onChange={handleFormChange} disabled={!formData.category}>
                    {categories[formData.category]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>Invoice Number</label>
                  <input 
                    type="text" 
                    name="invoiceNumber" 
                    value={formData.invoiceNumber} 
                    onChange={handleFormChange}
                    placeholder="e.g. INV-2026-001"
                  />
                </div>
                <div>
                  <label>Payment Mode</label>
                  <select name="paymentMode" value={formData.paymentMode} onChange={handleFormChange}>
                    {PAYMENT_MODES.map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>Employee Name</label>
                  <input 
                    type="text" 
                    name="employeeName" 
                    value={formData.employeeName} 
                    onChange={handleFormChange}
                    placeholder="e.g. Emma Watson"
                  />
                </div>
                <div>
                  <label>Vendor Name</label>
                  <input 
                    type="text" 
                    name="vendorName" 
                    value={formData.vendorName} 
                    onChange={handleFormChange}
                    placeholder="e.g. Google Ads Inc."
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>Department</label>
                  <select name="department" value={formData.department} onChange={handleFormChange}>
                    {availableDepartments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label>Invoice Attachment</label>
                <input
                  type="file"
                  onChange={handleAttachmentChange}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {formData.attachment ? `Selected: ${formData.attachment}` : 'Upload any invoice or supporting file for this expense record.'}
                </div>
              </div>

              <div>
                <label>Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleFormChange}
                  rows="3"
                  placeholder="Describe the purpose of this claim"
                />
              </div>

              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setFormModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {detailsModalOpen && selectedExpense && (
        <div className="dialog-backdrop">
          <div className="card dialog-card" role="dialog" aria-modal="true" aria-label={`Claim details ${selectedExpense.expenseId}`}>
            <button 
              onClick={() => setDetailsModalOpen(false)}
              className="dialog-close"
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase' }}>
                Claim File Details
              </h2>
              <span style={{ fontSize: '11px', padding: '1px 5px', backgroundColor: 'var(--border)', borderRadius: '2px', fontFamily: 'monospace' }}>
                {selectedExpense.expenseId}
              </span>
            </div>

            {/* Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Employee</span>
                <div style={{ fontWeight: 600, marginTop: '2px', fontSize: '14px' }}>{selectedExpense.employeeName}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Department</span>
                <div style={{ marginTop: '2px' }}>{selectedExpense.department}</div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Category</span>
                <div style={{ marginTop: '2px' }}>{selectedExpense.category}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Sub-Category</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{selectedExpense.subCategory}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Invoice Number</span>
                <div style={{ marginTop: '2px', fontFamily: 'monospace' }}>{selectedExpense.invoiceNumber || 'Not provided'}</div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Claim Amount</span>
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary)', marginTop: '2px' }}>{formatCurrency(selectedExpense.amount)}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Date Registered</span>
                <div style={{ marginTop: '2px' }}>{selectedExpense.date}</div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Vendor / Merchant</span>
                <div style={{ marginTop: '2px' }}>{selectedExpense.vendorName}</div>
              </div>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Method</span>
                <div style={{ marginTop: '2px' }}>{selectedExpense.paymentMode}</div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Receipt Attachment</span>
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>
                  <FileText size={14} />
                  <span style={{ textDecoration: 'underline' }}>{selectedExpense.attachment || 'No Invoice Attachment'}</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Description / Purpose</span>
              <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text)', marginTop: '4px', padding: '10px', backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                {selectedExpense.description || 'No description provided.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmOpen && selectedExpense && (
        <div className="dialog-backdrop" style={{ zIndex: 510 }}>
          <div className="card dialog-card dialog-card--sm" role="dialog" aria-modal="true" aria-label={`Delete ${selectedExpense.expenseId}`} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--danger)', margin: '10px 0 4px' }}>
              <Trash2 size={40} />
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' }}>Delete Expense Record?</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Are you sure you want to permanently remove the expense record <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{selectedExpense.expenseId}</strong>? This action cannot be undone.
            </p>

            <div className="dialog-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseTracker;
