// document.addEventListener("DOMContentLoaded", async () => {
//   const stripe = Stripe("your_stripe_publishable_key"); // Replace with your actual publishable key
//   const elements = stripe.elements();
//   const card = elements.create("card");
//   card.mount("#card-element");

//   document.getElementById("pay-btn").addEventListener("click", async () => {
//     const token = localStorage.getItem("token"); // Assuming user is logged in
//     const cart = JSON.parse(localStorage.getItem("cart")) || [];
//     const response = await fetch("/create-payment-intent", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: "Bearer " + token,
//       },
//       body: JSON.stringify({ cart }),
//     });
//     const { clientSecret } = await response.json();
//     const { error, paymentIntent } = await stripe.confirmCardPayment(
//       clientSecret,
//       {
//         payment_method: { card },
//       }
//     );
//     if (error) {
//       document.getElementById("payment-message").innerText =
//         "Payment failed: " + error.message;
//     } else {
//       document.getElementById("payment-message").innerText =
//         "Payment successful! Your order has been placed.";
//       // Optionally, clear the cart and redirect
//       localStorage.removeItem("cart");
//       setTimeout(() => {
//         window.location.href = "orders.html";
//       }, 2000);
//     }
//   });
// });
