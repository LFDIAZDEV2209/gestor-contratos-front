'use client';
import { createContext, useContext } from 'react';
// El store existente sigue siendo la única fuente de datos; esto solo invalida la UI del rol.
export const SessionRevision = createContext(0);
export const useSessionRevision = () => useContext(SessionRevision);
