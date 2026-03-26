export function getSubscriptionActionLabel(isFollowedByMe: boolean, isFollowingMe: boolean) {
  if (isFollowedByMe && isFollowingMe) {
    return 'Друг'
  }

  if (isFollowedByMe) {
    return 'Отписаться'
  }

  if (isFollowingMe) {
    return 'Подписаться в ответ'
  }

  return 'Подписаться'
}
