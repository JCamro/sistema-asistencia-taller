import { useState, useEffect } from 'react';

/**
 * Hook que devuelve el ancho actual de la ventana y se actualiza en cada resize.
 * Usado por ResponsiveTable y otros componentes para decidir layout desktop vs mobile.
 *
 * @returns window.innerWidth actual (number)
 */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(window.innerWidth);
  
  // Suscribe al evento resize y limpia el listener al desmontar para evitar memory leaks
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return width;
}
