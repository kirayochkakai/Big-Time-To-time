document.addEventListener("DOMContentLoaded", () => {
    const contactForm = document.getElementById("contactForm");

    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        sendContactMessage();
    });
});

function sendContactMessage() {
    const visitorName = document.getElementById("visitorName").value.trim() || "Utilisateur";
    const messageType = document.getElementById("messageType").value;
    const messageText = document.getElementById("messageText").value.trim();
    const email = "Nelson7@gmail.com";
    const subject = encodeURIComponent(`${messageType} - Big time To time`);
    const body = encodeURIComponent(`Nom: ${visitorName}\n\nMessage:\n${messageText}`);

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}