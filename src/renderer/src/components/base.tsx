/// <reference types="vite/client" />
import '../../../preload/index.d';
import React, { ReactNode } from 'react'
import { ThemeProvider, createTheme } from "@mui/material/styles"
import useMediaQuery  from "@mui/material/useMediaQuery"
import CssBaseline  from "@mui/material/CssBaseline"

export default function Base( props: {  children: ReactNode } ) {

  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = createTheme({
    typography: { button: { textTransform: 'none' } },
    palette: { mode: isDarkMode ? "dark" : 'light' }
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      { props.children }
    </ThemeProvider>
  )
}