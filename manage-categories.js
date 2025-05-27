document.addEventListener("DOMContentLoaded", () => {
  const categories = [];
  const subcategories = [];
  const descriptors = [];

  const categoryForm = document.getElementById("category-form");
  const subcategoryForm = document.getElementById("subcategory-form");
  const descriptorForm = document.getElementById("descriptor-form");

  const categoriesList = document.getElementById("categories-ul");
  const subcategoriesList = document.getElementById("subcategories-ul");
  const descriptorsList = document.getElementById("descriptors-ul");

  const subcategoryCategorySelect = document.getElementById("subcategory-category");
  const descriptorSubcategorySelect = document.getElementById("descriptor-subcategory");

  // Add category
  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const categoryName = document.getElementById("category-name").value.trim();

    if (!categoryName) {
      alert("Category name is required.");
      return;
    }

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });

      if (response.ok) {
        alert("Category added successfully.");
        fetchCategories(); // Refresh the categories table
        categoryForm.reset();
      } else {
        const errorText = await response.text();
        alert(`Failed to add category: ${errorText}`);
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('An error occurred while adding the category.');
    }
  });

  // Add subcategory
  subcategoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const categoryId = parseInt(subcategoryCategorySelect.value, 10);
    const subcategoryName = document.getElementById("subcategory-name").value.trim();

    if (!categoryId || !subcategoryName) {
      alert("Both category and subcategory name are required.");
      return;
    }

    try {
      const response = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subcategoryName, categoryId }),
      });

      if (response.ok) {
        alert("Subcategory added successfully.");
        fetchSubcategories(); // Refresh the subcategories table
        subcategoryForm.reset();
      } else {
        const errorText = await response.text();
        alert(`Failed to add subcategory: ${errorText}`);
      }
    } catch (error) {
      console.error('Error adding subcategory:', error);
      alert('An error occurred while adding the subcategory.');
    }
  });

  // Add descriptor
  descriptorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const subcategoryId = parseInt(descriptorSubcategorySelect.value, 10);
    const descriptorName = document.getElementById("descriptor-name").value.trim();

    if (!subcategoryId || !descriptorName) {
      alert("Both subcategory and descriptor name are required.");
      return;
    }

    try {
      const response = await fetch('/api/descriptors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: descriptorName, subCategoryId: subcategoryId }),
      });

      if (response.ok) {
        alert("Descriptor added successfully.");
        fetchDescriptors(); // Refresh the descriptors table
        descriptorForm.reset();
      } else {
        const errorText = await response.text();
        alert(`Failed to add descriptor: ${errorText}`);
      }
    } catch (error) {
      console.error('Error adding descriptor:', error);
      alert('An error occurred while adding the descriptor.');
    }
  });

  window.deleteCategory = async function (categoryId) {
    try {
      // Fetch associated subcategories
      const response = await fetch(`/api/categories/${categoryId}/subcategories`);
      const subcategories = await response.json();

      if (subcategories.length > 0) {
        const subcategoryNames = subcategories.map(s => s.SubCategoryName).join(', ');
        const confirmDelete = confirm(
          `This category has the following subcategories: ${subcategoryNames}. Do you want to delete the category and all its subcategories?`
        );
        if (!confirmDelete) return;
      }

      // Proceed with deletion
      const deleteResponse = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
      if (deleteResponse.ok) {
        alert('Category deleted successfully.');
        fetchCategories(); // Refresh the categories table
        fetchSubcategories(); // Refresh the subcategories table
      } else {
        const errorText = await deleteResponse.text();
        alert(`Failed to delete category: ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('An error occurred while deleting the category.');
    }
  }

  window.deleteSubcategory = async function (subcategoryId) {
    try {
      // Fetch associated descriptors
      const response = await fetch(`/api/subcategories/${subcategoryId}/descriptors`);
      const descriptors = await response.json();

      if (descriptors.length > 0) {
        const descriptorNames = descriptors.map(d => d.DescriptorName).join(', ');
        const confirmDelete = confirm(
          `This subcategory has the following descriptors: ${descriptorNames}. Do you want to delete the subcategory and all its descriptors?`
        );
        if (!confirmDelete) return;
      }

      // Proceed with deletion
      const deleteResponse = await fetch(`/api/subcategories/${subcategoryId}`, { method: 'DELETE' });
      if (deleteResponse.ok) {
        alert('Subcategory deleted successfully.');
        fetchSubcategories(); // Refresh the subcategories table
        fetchDescriptors(); // Refresh the descriptors table
      } else {
        const errorText = await deleteResponse.text();
        alert(`Failed to delete subcategory: ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      alert('An error occurred while deleting the subcategory.');
    }
  }

  window.editCategory = async function (categoryId) {
    const newName = prompt('Enter the new name for the category:');
    if (!newName) {
      alert('Category name cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        alert('Category updated successfully.');
        fetchCategories(); // Refresh the categories table
      } else {
        const errorText = await response.text();
        alert(`Failed to update category: ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert('An error occurred while updating the category.');
    }
  }

  window.editSubcategory = async function (subcategoryId) {
    console.log(`Editing subcategory with ID: ${subcategoryId}`); // Debug log
    const newName = prompt('Enter the new name for the subcategory:');
    if (!newName) {
        alert('Subcategory name cannot be empty.');
        return;
    }

    // Fetch categories to allow the user to select a new category
    const categoriesResponse = await fetch('/api/categories');
    const categories = await categoriesResponse.json();

    const categoryOptions = categories.map(category => `${category.id}: ${category.name}`).join('\n');
    const newCategoryId = prompt(`Select a new category ID for the subcategory:\n${categoryOptions}`);

    if (!newCategoryId || isNaN(newCategoryId)) {
        alert('A valid category ID is required.');
        return;
    }

    try {
        const response = await fetch(`/api/subcategories/${subcategoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, categoryId: parseInt(newCategoryId, 10) }),
        });

        if (response.ok) {
            alert('Subcategory updated successfully.');
            fetchSubcategories(); // Refresh the subcategories table
        } else {
            const errorText = await response.text();
            console.error(`Failed to update subcategory: ${errorText}`); // Log error details
            alert(`Failed to update subcategory: ${errorText}`);
        }
    } catch (error) {
        console.error('Error updating subcategory:', error);
        alert('An error occurred while updating the subcategory.');
    }
};

  window.editDescriptor = async function (descriptorId) {
    console.log(`Editing descriptor with ID: ${descriptorId}`); // Debug log
    const newName = prompt('Enter the new name for the descriptor:');
    if (!newName) {
        alert('Descriptor name cannot be empty.');
        return;
    }

    // Create a dropdown for selecting a new subcategory
    const subcategoriesResponse = await fetch('/api/subcategories');
    const subcategories = await subcategoriesResponse.json();

    const subcategoryOptions = subcategories.map(subcategory => `${subcategory.id}: ${subcategory.name}`).join('\n');
    const newSubCategoryId = prompt(`Select a new subcategory ID for the descriptor:\n${subcategoryOptions}`);

    if (!newSubCategoryId || isNaN(newSubCategoryId)) {
        alert('A valid subcategory ID is required.');
        return;
    }

    try {
        const response = await fetch(`/api/descriptors/${descriptorId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, subCategoryId: parseInt(newSubCategoryId, 10) }),
        });

        if (response.ok) {
            alert('Descriptor updated successfully.');
            fetchDescriptors(); // Refresh the descriptors table
        } else {
            const errorText = await response.text();
            console.error(`Failed to update descriptor: ${errorText}`); // Log error details
            alert(`Failed to update descriptor: ${errorText}`);
        }
    } catch (error) {
        console.error('Error updating descriptor:', error);
        alert('An error occurred while updating the descriptor.');
    }
};

  window.deleteDescriptor = async function (descriptorId) {
    if (confirm('Are you sure you want to delete this descriptor?')) {
      try {
        const response = await fetch(`/api/descriptors/${descriptorId}`, { method: 'DELETE' });

        if (response.ok) {
          alert('Descriptor deleted successfully.');
          fetchDescriptors(); // Refresh the descriptors table
        } else {
          const errorText = await response.text();
          alert(`Failed to delete descriptor: ${errorText}`);
        }
      } catch (error) {
        console.error('Error deleting descriptor:', error);
        alert('An error occurred while deleting the descriptor.');
      }
    }
  };

  async function fetchCategories() {
    const response = await fetch('/api/categories');
    const categories = await response.json();

    // Populate the categories table
    const tableBody = document.getElementById('categories-table-body');
    tableBody.innerHTML = ''; // Clear existing rows
    categories.forEach(category => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${category.id}</td> <!-- Use 'id' instead of 'CategoryID' -->
        <td>${category.name}</td> <!-- Use 'name' instead of 'Name' -->
        <td>
          <button class="filtEditBtn" onclick="editCategory(${category.id})">Edit</button>
          <button class="filtDeleteBtn" onclick="deleteCategory(${category.id})">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Populate the "Select Category" dropdown in the subcategory form
    const subcategoryCategorySelect = document.getElementById('subcategory-category');
    subcategoryCategorySelect.innerHTML = '<option value="">Select a category</option>'; // Reset dropdown
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id; // Use 'id' as the value
      option.textContent = category.name; // Use 'name' as the display text
      subcategoryCategorySelect.appendChild(option);
    });
  }

  async function fetchSubcategories() {
    const response = await fetch('/api/subcategories');
    const subcategories = await response.json();

    // Populate the subcategories table
    const tableBody = document.getElementById('subcategories-table-body');
    tableBody.innerHTML = ''; // Clear existing rows
    subcategories.forEach(subcategory => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${subcategory.id}</td> <!-- Use 'id' instead of 'SubCategoryID' -->
        <td>${subcategory.name}</td> <!-- Use 'name' instead of 'SubCategoryName' -->
        <td>${subcategory.categoryId}</td> <!-- Use 'categoryId' instead of 'CategoryID' -->
        <td>
          <button class="filtEditBtn" onclick="editSubcategory(${subcategory.id})">Edit</button>
          <button class="filtDeleteBtn" onclick="deleteSubcategory(${subcategory.id})">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Populate the "Select Subcategory" dropdown in the descriptor form
    const descriptorSubcategorySelect = document.getElementById('descriptor-subcategory');
    descriptorSubcategorySelect.innerHTML = '<option value="">Select a subcategory</option>'; // Reset dropdown
    subcategories.forEach(subcategory => {
      const option = document.createElement('option');
      option.value = subcategory.id; // Use 'id' as the value
      option.textContent = subcategory.name; // Use 'name' as the display text
      descriptorSubcategorySelect.appendChild(option);
    });
  }

  async function fetchDescriptors() {
    const response = await fetch('/api/descriptors');
    const descriptors = await response.json();
    const tableBody = document.getElementById('descriptors-table-body');
    tableBody.innerHTML = ''; // Clear existing rows
    descriptors.forEach(descriptor => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${descriptor.id}</td> <!-- Use 'id' instead of 'DescriptorID' -->
        <td>${descriptor.name}</td> <!-- Use 'name' instead of 'DescriptorName' -->
        <td>${descriptor.subCategoryId}</td> <!-- Use 'subCategoryId' instead of 'SubCategoryID' -->
        <td>
          <button class="filtEditBtn" onclick="editDescriptor(${descriptor.id})">Edit</button>
          <button class="filtDeleteBtn" onclick="deleteDescriptor(${descriptor.id})">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Call fetch functions on page load
  fetchCategories();
  fetchSubcategories();
  fetchDescriptors();
});
