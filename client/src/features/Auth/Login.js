import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { login } from './authSlice';
import Button from '../../components/Button';
import { createSelector } from '@reduxjs/toolkit';
import Resend from './Resend';

const sel = createSelector(
    [state => state.auth.inactive, state => state.auth.loading],
    (inactive, loading) => ({ inactive, loading })
);

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember: false
    });
    const dispatch = useDispatch();
    const { loading, inactive } = useSelector(sel);
    const [userEmail, setUserEmail] = useState('');

    const onChange = e => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };
    const checkBoxChange = e => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.checked
        });
    };

    const { email, password, remember } = formData;
    const onSubmit = e => {
        e.preventDefault();
        dispatch(login(email, password, remember));
        setUserEmail(email);
    };
    return (
        <form onSubmit={onSubmit}>
            <label className='auth__label'>
                Email:
                <input
                    className='auth__input auth__input--text input'
                    type='email'
                    name='email'
                    placeholder='Email'
                    onChange={onChange}
                    value={email}
                    required
                />
            </label>
            <label className='auth__label'>
                Password
                <input
                    className='auth__input auth__input--text input'
                    type='password'
                    name='password'
                    placeholder='Password'
                    onChange={onChange}
                    value={password}
                    minLength='6'
                    required
                />
            </label>
            <label className='auth__label'>
                <input
                    className='auth__input'
                    type='checkbox'
                    name='remember'
                    checked={remember}
                    onChange={checkBoxChange}
                />{' '}
                Remember me
            </label>
            <div className='auth__input'>
                <Button full value='Submit' loading={loading && 'Loading'} />
            </div>
            {inactive && (
                <div className='auth__card__info'>
                    <span className='auth__card__info--warning'>
                        Please verify your email(<b>{userEmail}</b>) before logging in.{' '}
                        <Resend requestFor={userEmail} />
                    </span>
                </div>
            )}
        </form>
    );
};

export default Login;
