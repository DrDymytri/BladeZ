// Order processing module for BladeZ application

document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('order-form');
    const orderStatus = document.getElementById('order-status');
    
    if (orderForm) {
        orderForm.addEventListener('submit', submitOrder);
    }
    
    // Load any existing order information
    loadOrderHistory();
});

async function submitOrder(event) {
    event.preventDefault();
    
    // Show processing status
    updateOrderStatus('Processing your order...', 'info');
    
    try {
        // Get cart items from localStorage
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (cart.length === 0) {
            updateOrderStatus('Your cart is empty', 'error');
            return;
        }
        
        // Get customer information from form
        const formData = new FormData(event.target);
        const orderData = {
            customer: {
                name: formData.get('name'),
                email: formData.get('email'),
                address: formData.get('address'),
                phone: formData.get('phone')
            },
            items: cart,
            total: calculateTotal(cart),
            paymentMethod: formData.get('payment-method')
        };
        
        // Submit order using the API service
        const response = await apiService.post('/api/orders', orderData);
        
        if (response.success) {
            // Clear cart after successful order
            localStorage.removeItem('cart');
            updateCartCount();
            updateOrderStatus('Order placed successfully! Order #' + response.orderId, 'success');
            
            // Redirect to confirmation page
            setTimeout(() => {
                window.location.href = '/confirmation.html?order=' + response.orderId;
            }, 2000);
        } else {
            updateOrderStatus('Order failed: ' + (response.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Order submission error:', error);
        updateOrderStatus('Failed to place order. Please try again.', 'error');
    }
}

function updateOrderStatus(message, type = 'info') {
    const orderStatus = document.getElementById('order-status');
    if (orderStatus) {
        orderStatus.textContent = message;
        orderStatus.className = 'status-' + type;
        orderStatus.style.display = 'block';
    }
}

function calculateTotal(cart) {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
}

async function loadOrderHistory() {
    const orderHistoryContainer = document.getElementById('order-history');
    if (!orderHistoryContainer) return;
    
    try {
        // Get user token if available
        const token = localStorage.getItem('userToken');
        if (!token) {
            orderHistoryContainer.innerHTML = '<p>Please log in to view your order history</p>';
            return;
        }
        
        const response = await apiService.get('/api/orders/history', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.length === 0) {
            orderHistoryContainer.innerHTML = '<p>No previous orders found</p>';
            return;
        }
        
        // Render order history
        orderHistoryContainer.innerHTML = response.map(order => `
            <div class="order-item">
                <h3>Order #${order.id}</h3>
                <p>Date: ${new Date(order.date).toLocaleDateString()}</p>
                <p>Status: ${order.status}</p>
                <p>Total: $${order.total.toFixed(2)}</p>
                <button class="view-details-btn" data-order-id="${order.id}">View Details</button>
            </div>
        `).join('');
        
        // Add event listeners to view details buttons
        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', () => {
                window.location.href = `/order-details.html?id=${button.dataset.orderId}`;
            });
        });
    } catch (error) {
        console.error('Failed to load order history:', error);
        orderHistoryContainer.innerHTML = '<p>Failed to load order history. Please try again later.</p>';
    }
}

// Update cart count in the header
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0);
    const cartCountElem = document.getElementById('cart-count');
    if (cartCountElem) cartCountElem.textContent = totalQuantity;
}
