const parseDateStrict = (input) => {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  if (typeof input !== 'string' && typeof input !== 'number') {
    throw new Error('Invalid date input');
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  return date;
};

const formatYYYYMM = (dateInput) => {
  const date = parseDateStrict(dateInput);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const toMonthStart = (dateInput) => `${formatYYYYMM(dateInput)}-01`;

module.exports = {
  parseDateStrict,
  toMonthStart,
  formatYYYYMM
};
