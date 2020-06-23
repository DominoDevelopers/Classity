import React, { useState, Fragment } from 'react';
import AnimateHeight from 'react-animate-height';

import AddNew from '../AddNew';
import Editable from '../Editable';

import './Collapse.css';

const Container = props => {
    const { editing, children } = props;
    const [toShow, show] = useState('head');

    const toggleShow = e => {
        const current = document.getElementById(toShow);
        if (current) {
            current.classList.remove('show');
            current.classList.add('hide');
        }

        const parent = e.target.closest('li');
        if (parent.id !== toShow) {
            parent.classList.add('show');
            parent.classList.remove('hide');
            show(parent.id);
        } else {
            show('head');
        }
    };

    return (
        <ul className='course-topics'>
            {React.Children.toArray(children).map((e, i) => (
                <li className='hide' id={'head' + i} key={i}>
                    {React.cloneElement(e, {
                        id: 'head' + i,
                        toShow,
                        toggleShow,
                        editing
                    })}
                </li>
            ))}
        </ul>
    );
};

const Head = props => {
    const { text, toggleShow, toShow, id, editing, children, onChange } = props;

    const editable = onChange ? true : false;

    return (
        <Fragment>
            {editing && editable ? (
                <p>
                    <i className='fas fa-minus delete-btn'></i>
                    <Editable text={text} onChange={onChange} tagName='span' />
                </p>
            ) : (
                text && (
                    <p onClick={toggleShow}>
                        <i className='fas fa-plus show-button'></i>
                        <i className='fas fa-minus hide-button'></i>
                        <span
                            dangerouslySetInnerHTML={{
                                __html: text
                            }}
                        />
                    </p>
                )
            )}

            <AnimateHeight height={toShow === id || editing ? 'auto' : 0}>
                <ul>
                    {React.Children.toArray(children).map((e, i) => (
                        <Fragment key={i}>
                            {React.cloneElement(e, { editing })}
                        </Fragment>
                    ))}
                </ul>
            </AnimateHeight>
        </Fragment>
    );
};

const Item = props => {
    const { children, editing, add } = props;

    return (
        <li>
            {editing && add ? (
                <AddNew>
                    <i className='fas fa-plus'></i>
                    {children}
                </AddNew>
            ) : (
                !add && <p>{children}</p>
            )}
        </li>
    );
};

export default { Container, Head, Item };