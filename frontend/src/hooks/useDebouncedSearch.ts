import { useState, useEffect } from 'react';

export function useDebouncedSearch(delay = 300) {
  const [searchText, setSearchText] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(searchText), delay);
    return () => clearTimeout(timer);
  }, [searchText, delay]);

  return { searchText, setSearchText, debouncedValue };
}

export default useDebouncedSearch;
