import { useEffect, useState } from 'react';
import { Building2, FolderOpen, Layers, Plus, Trash2 } from 'lucide-react';
import {
  addDepartment,
  addExpenseCategory,
  addExpenseSubCategory,
  removeDepartment,
  removeExpenseCategory,
  removeExpenseSubCategory
} from '../services/categories';
import { getExpenses } from '../services/expenseService';

function CategoryManagement({ categories, departments, onCategoriesChange, onDepartmentsChange, showToast }) {
  const categoryNames = Object.keys(categories);
  const [selectedCategory, setSelectedCategory] = useState(categoryNames[0] || '');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');

  useEffect(() => {
    if (!categoryNames.length) {
      setSelectedCategory('');
      return;
    }

    if (!categories[selectedCategory]) {
      setSelectedCategory(categoryNames[0]);
    }
  }, [categories, categoryNames, selectedCategory]);

  const expenses = getExpenses();
  const subCategories = selectedCategory ? categories[selectedCategory] || [] : [];
  const totalSubCategories = categoryNames.reduce(
    (count, categoryName) => count + (categories[categoryName]?.length || 0),
    0
  );

  const categoryUsageCount = selectedCategory
    ? expenses.filter((expense) => expense.category === selectedCategory).length
    : 0;
  const totalDepartments = departments.length;

  const handleAddCategory = async (event) => {
    event.preventDefault();

    try {
      const updatedCategories = await addExpenseCategory(newCategoryName);
      setNewCategoryName('');
      setSelectedCategory(newCategoryName.trim());
      onCategoriesChange(updatedCategories);
      showToast('Category added successfully', 'success');
    } catch (error) {
      showToast(error.message, 'warning');
    }
  };

  const handleRemoveCategory = async (categoryName) => {
    const usageCount = expenses.filter((expense) => expense.category === categoryName).length;
    const confirmed = window.confirm(
      usageCount > 0
        ? `${categoryName} is used in ${usageCount} expense record(s). Remove it from future selection anyway?`
        : `Remove ${categoryName}?`
    );

    if (!confirmed) {
      return;
    }

    const updatedCategories = await removeExpenseCategory(categoryName);
    onCategoriesChange(updatedCategories);
    showToast('Category removed successfully', 'success');
  };

  const handleAddSubCategory = async (event) => {
    event.preventDefault();

    if (!selectedCategory) {
      showToast('Create a category first', 'warning');
      return;
    }

    try {
      const updatedCategories = await addExpenseSubCategory(selectedCategory, newSubCategoryName);
      setNewSubCategoryName('');
      onCategoriesChange(updatedCategories);
      showToast('Sub-category added successfully', 'success');
    } catch (error) {
      showToast(error.message, 'warning');
    }
  };

  const handleRemoveSubCategory = async (subCategoryName) => {
    const usageCount = expenses.filter(
      (expense) => expense.category === selectedCategory && expense.subCategory === subCategoryName
    ).length;
    const confirmed = window.confirm(
      usageCount > 0
        ? `${subCategoryName} is used in ${usageCount} expense record(s). Remove it from future selection anyway?`
        : `Remove ${subCategoryName}?`
    );

    if (!confirmed) {
      return;
    }

    const updatedCategories = await removeExpenseSubCategory(selectedCategory, subCategoryName);
    onCategoriesChange(updatedCategories);
    showToast('Sub-category removed successfully', 'success');
  };

  const handleAddDepartment = async (event) => {
    event.preventDefault();

    try {
      const updatedDepartments = await addDepartment(newDepartmentName);
      setNewDepartmentName('');
      onDepartmentsChange(updatedDepartments);
      showToast('Department added successfully', 'success');
    } catch (error) {
      showToast(error.message, 'warning');
    }
  };

  const handleRemoveDepartment = async (departmentName) => {
    const usageCount = expenses.filter((expense) => expense.department === departmentName).length;
    const confirmed = window.confirm(
      usageCount > 0
        ? `${departmentName} is used in ${usageCount} expense record(s). Remove it from future selection anyway?`
        : `Remove ${departmentName}?`
    );

    if (!confirmed) {
      return;
    }

    const updatedDepartments = await removeDepartment(departmentName);
    onDepartmentsChange(updatedDepartments);
    showToast('Department removed successfully', 'success');
  };

  return (
    <div className="panel-stack">
      <div className="grid-3">
        <div className="card metric-card" style={{ '--metric-accent': 'var(--primary)', '--metric-soft': 'var(--primary-soft)' }}>
          <div className="metric-icon">
            <FolderOpen size={18} />
          </div>
          <div>
            <div className="metric-label">Categories</div>
            <div className="metric-value">{categoryNames.length}</div>
          </div>
        </div>

        <div className="card metric-card" style={{ '--metric-accent': 'var(--success)', '--metric-soft': 'var(--success-soft)' }}>
          <div className="metric-icon">
            <Layers size={18} />
          </div>
          <div>
            <div className="metric-label">Sub-Categories</div>
            <div className="metric-value">{totalSubCategories}</div>
          </div>
        </div>

        <div className="card metric-card" style={{ '--metric-accent': 'var(--warning)', '--metric-soft': 'var(--warning-soft)' }}>
          <div className="metric-icon">
            <Building2 size={18} />
          </div>
          <div>
            <div className="metric-label">Departments</div>
            <div className="metric-value">{totalDepartments}</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category Directory</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manage top-level accounting buckets</span>
          </div>

          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Add new category"
              style={{ flex: '1 1 220px' }}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={14} />
              Add Category
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categoryNames.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                No categories available yet.
              </div>
            ) : (
              categoryNames.map((categoryName) => {
                const isActive = selectedCategory === categoryName;
                const itemUsage = expenses.filter((expense) => expense.category === categoryName).length;

                return (
                  <div
                    key={categoryName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '12px 14px',
                      border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'var(--primary-soft)' : 'var(--surface)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(categoryName)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        flex: 1
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{categoryName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {categories[categoryName]?.length || 0} sub-categories, {itemUsage} linked records
                      </div>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleRemoveCategory(categoryName)}
                      style={{ color: 'var(--danger)', padding: '6px' }}
                      title="Remove category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-Category Manager</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {selectedCategory || 'Select a category to manage its sub-categories'}
              </div>
            </div>
          </div>

          <form onSubmit={handleAddSubCategory} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={newSubCategoryName}
              onChange={(event) => setNewSubCategoryName(event.target.value)}
              placeholder="Add new sub-category"
              style={{ flex: '1 1 220px' }}
              disabled={!selectedCategory}
            />
            <button type="submit" className="btn btn-primary" disabled={!selectedCategory}>
              <Plus size={14} />
              Add Sub-Category
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!selectedCategory ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                Select a category from the left panel first.
              </div>
            ) : subCategories.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                No sub-categories added yet for this category.
              </div>
            ) : (
              subCategories.map((subCategoryName) => {
                const usageCount = expenses.filter(
                  (expense) => expense.category === selectedCategory && expense.subCategory === subCategoryName
                ).length;

                return (
                  <div
                    key={subCategoryName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '12px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--surface)'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {subCategoryName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {usageCount} linked records
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleRemoveSubCategory(subCategoryName)}
                      style={{ color: 'var(--danger)', padding: '6px' }}
                      title="Remove sub-category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department Manager</h3>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Control which departments appear in the expense dropdown.
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{categoryUsageCount} records in selected category</span>
        </div>

        <form onSubmit={handleAddDepartment} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newDepartmentName}
            onChange={(event) => setNewDepartmentName(event.target.value)}
            placeholder="Add new department"
            style={{ flex: '1 1 220px' }}
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={14} />
            Add Department
          </button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {departments.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
              No departments available yet.
            </div>
          ) : (
            departments.map((departmentName) => {
              const usageCount = expenses.filter((expense) => expense.department === departmentName).length;

              return (
                <div
                  key={departmentName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface)'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {departmentName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {usageCount} linked records
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleRemoveDepartment(departmentName)}
                    style={{ color: 'var(--danger)', padding: '6px' }}
                    title="Remove department"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryManagement;
