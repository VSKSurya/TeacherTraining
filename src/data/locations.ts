import { kgbvSchools } from './kgbvSchools';

const stateOrder = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Chhattisgarh', 'Gujarat', 'Haryana',
  'Jharkhand', 'Karnataka', 'Manipur', 'Rajasthan', 'Sikkim', 'Telangana', 'Uttar Pradesh',
];

export const locations = stateOrder.map(name => ({
  name,
  districts: [...new Set(kgbvSchools.filter(school => school.state === name).map(school => school.district))],
}));
