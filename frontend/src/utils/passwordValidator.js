export function validatePassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (password.length > 16) {
    errors.push("Password must not exceed 16 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one capital letter");
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*...)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
