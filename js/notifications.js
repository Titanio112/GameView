import { getNotifications, markNotificationsRead } from './api.js';
import { getCurrentUser } from './auth.js';

let notifications = [];
let unreadCount = 0;

export async function loadNotifications() {
  const user = getCurrentUser();
  if (!user) return [];
  notifications = await getNotifications(user.id);
  unreadCount = notifications.filter(n => !n.read).length;
  return notifications;
}

export function getUnreadCount() {
  return unreadCount;
}

export async function markAllRead() {
  const user = getCurrentUser();
  if (!user) return;
  await markNotificationsRead(user.id);
  unreadCount = 0;
}

export function renderNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}
