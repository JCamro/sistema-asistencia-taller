import { useState, useEffect } from 'react';

/**
 * Hook que retrasa la actualización de un valor de búsqueda hasta que el usuario
 * deja de escribir por `delay` milisegundos. Evita llamadas prematuras al API.
 *
 * @param delay - Tiempo de espera en ms antes de propagar el valor (default: 300)
 * @returns searchText (valor inmediato), setSearchText (setter), debouncedValue (valor con retraso)
 */
export function useDebouncedSearch(delay = 300) {
  const [searchText, setSearchText] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(searchText), delay);
    return () => clearTimeout(timer);
  }, [searchText, delay]);

  const resetSearch = () => {
    setSearchText('');
    setDebouncedValue('');
  };

  return { searchText, setSearchText, debouncedValue, resetSearch };
}

export default useDebouncedSearch;
