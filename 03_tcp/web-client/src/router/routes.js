import Login from '../pages/Login.js';
import Chat from '../pages/Chat.js';
import { Router } from './Router.js';

const urls = {
    '/': Login,
    '/chat': Chat,
};

export const routes = Router(urls);
