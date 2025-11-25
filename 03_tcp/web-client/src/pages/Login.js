function Login() {
    const container = document.createElement('div');
    container.className = 'login-container';

    const title = document.createElement('h1');
    title.innerText = '💬 TCP Chat';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.innerText = 'Multi-Protocol Chat System';
    subtitle.style.marginBottom = '40px';
    subtitle.style.color = '#666';
    container.appendChild(subtitle);

    const form = document.createElement('div');
    form.className = 'login-form';

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Enter your username';
    usernameInput.id = 'username-input';
    form.appendChild(usernameInput);

    const loginButton = document.createElement('button');
    loginButton.innerText = 'Join Chat';
    loginButton.onclick = async () => {
        const username = usernameInput.value.trim();
        if (username) {
            // Store username in sessionStorage
            sessionStorage.setItem('username', username);
            // Navigate to chat
            window.location.href = '/chat';
        } else {
            alert('Please enter a username');
        }
    };
    form.appendChild(loginButton);

    container.appendChild(form);

    return container;
}

export default Login;
