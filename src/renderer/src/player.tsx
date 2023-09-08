/// <reference types="vite/client" />
import '../../preload/index.d';
import React, { useState, useEffect, useRef } from 'react'

import BaseStyle from './components/base';
import AppBar from './components/appBar';

import {
  Box, Button, InputLabel, MenuItem, FormControl, styled, Paper,
  Select, SelectChangeEvent, TextField, Switch, Stack, Checkbox,
  FormGroup, FormControlLabel, FormLabel, Radio, RadioGroup
} from "@mui/material"

export default function Player() {

  return (
    <BaseStyle>
      <AppBar />
      <h1>Player</h1>
    </BaseStyle>
  )
}