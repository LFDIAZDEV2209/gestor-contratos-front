'use client';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({className='', ...props}, ref) { return <input {...props} ref={ref} className={`control ${className}`} />; });
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({className='', ...props}, ref) { return <select {...props} ref={ref} className={`control ${className}`} />; });
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({className='', ...props}, ref) { return <textarea {...props} ref={ref} className={`control ${className}`} />; });
