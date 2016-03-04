'use strict';

import User from './models/user';
import Merchant from './models/merchant';
import Shopper from './models/shopper';
import Admin from './models/admin';
import Delegate from './models/delegate';
import config from '../../config/defaults';
import jwt from 'jsonwebtoken';
import {
    toTitleCase
}
from './utils/helpers';
import mongoose from 'mongoose';

let outcome = {
    success: false,
    errors: [],
    errFor: {}
};

const adminPermissions = ['adminAccounts', 'userAccounts'];
const delegateRoles = ['Inventory Management', 'Sales', 'Customer Service'];

export function validate(userObject) {
    return new Promise(function(resolve, reject) {
        if (!userObject.username) {
            outcome.errFor.username = 'username required';
        } else if (!/^[a-zA-Z0-9.\-_$@*!]{3,30}$/.test(userObject.username)) {
            outcome.errFor.username = 'Usernames can only include letters, numbers, and these characters ., -, _, $, @, *, !';
        }

        if (!userObject.email) {
            outcome.errFor.email = 'email required';
        } else if (!/^[a-zA-Z0-9\-\_\.\+]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_]+$/.test(userObject.email)) {
            outcome.errFor.email = 'invalid email format';
        }

        if (!userObject.password) {
            outcome.errFor.password = 'password required';
        }

        if (hasErrors(outcome)) {
            reject(outcome);
        }
        resolve(userObject);
    });
}

export function duplicateUsernameCheck(userObject) {
    return new Promise(function(resolve, reject) {
        User.findOne({
            username: userObject.username
        }, function(err, user) {
            if (err) {
                outcome.errors.push('Exception: ' + err);
            }

            if (user) {
                outcome.errFor.username = 'username already taken';
            }

            if (hasErrors(outcome)) {
                reject(outcome.errFor.username);
            }

            resolve(userObject);
        });
    });
}

export function duplicateEmailCheck(userObject) {
    return new Promise(function(resolve, reject) {
        User.findOne({
            email: userObject.email.toLowerCase()
        }, function(err, user) {
            if (err) {
                outcome.errors.push('Exception: ' + err);
            }

            if (user) {
                outcome.errFor.email = 'email already registered';
            }

            if (hasErrors(outcome)) {
                reject(outcome.errFor.email);
            }

            resolve(user);
        });
    });
}

export function createUser(userObject) {
    return new Promise((resolve, reject) => {
        User.encryptPassword(userObject.password, function(err, passwordHash) {
            if (err) {
                reject(err);
            }

            let fieldsToSet = {
                username: userObject.username,
                password: passwordHash,
                email: userObject.email.toLowerCase(),
                isActive: true,
                location: userObject.location,
                state: userObject.state,
                postCode: userObject.postcode,
                address: userObject.address
            };

            User.create(fieldsToSet, function(err, user) {
                if (err) reject(err);
                resolve(user);
            });
        });
    });
}

export function createAccount(userObject, id) {
    switch (userObject.action.type) {
        case 'CREATE_MERCHANT':
            return createMerchant(userObject);
            break;
        case 'CREATE_ADMIN':
            return createAdmin(userObject);
            break;
        case 'CREATE_SHOPPER':
            return createShopper(userObject);
            break;
        case 'CREATE_DELEGATE':
            return createDelegate(userObject, id);
            break;
        default:
            return Promise.reject('Invalid_Action');
            break;
    }
}

export function createMerchant(userObject) {
    return new Promise(function(resolve, reject) {
        createUser(userObject).then(function(user) {
            let fieldsToSet = {
                user: user._id,
                companyName: userObject.companyName,
                phone: userObject.phone,
                isVerified: true,
                delegates: []
            };

            if (config.requireAccountVerification) {
                User.createVerificationToken((err, token, hash) => {
                    if (err) reject(err);
                    fieldsToSet.isVerified = false;
                    fieldsToSet.verificationToken = hash;

                    Merchant.create(fieldsToSet, function(err, merchant) {
                        if (err) reject(err);

                        user.roles.merchant = merchant._id;
                        user.save(function(err, user) {
                            if (err) reject(err);

                            resolve(merchant);
                        });
                    });
                });
            } else {
                Merchant.create(fieldsToSet, function(err, merchant) {
                    if (err) reject(err);

                    user.roles.merchant = merchant._id;
                    user.save(function(err, user) {
                        if (err) reject(err);
                        resolve(merchant);
                    });
                });
            }
        }, function(err) {
            reject(err);
        });
    });
}

export function createAdmin(userObject) {
    return new Promise(function(resolve, reject) {
        createUser(userObject).then(function(user) {
            let fieldsToSet = {
                user: user._id,
                firstName: userObject.fname,
                lastName: userObject.lname,
                permissions: userObject.permissions
            };

            Admin.create(fieldsToSet, function(err, admin) {
                if (err) reject(err);

                user.roles.admin = admin._id;
                user.save(function(err, user) {
                    if (err) reject(err);

                    resolve(admin);
                });
            });
        }, function(err) {
            reject(err);
        });
    });
}

export function createShopper(userObject) {
    return new Promise(function(resolve, reject) {
        createUser(userObject).then(function(user) {
            let fieldsToSet = {
                user: user._id,
                title: userObject.title,
                firstName: userObject.firstName,
                lastName: userObject.lastName,
                avatarUrl: userObject.avatarUrl,
                homePhone: userObject.homePhone,
                mobilePhone: userObject.mobilePhone,
                gender: userObject.gender,
                isVerified: true
            };

            if (config.requireAccountVerification) {
                User.createVerificationToken((err, token, hash) => {
                    if (err) reject(err);
                    fieldsToSet.isVerified = false;
                    fieldsToSet.verificationToken = hash;

                    Shopper.create(fieldsToSet, function(err, shopper) {
                        if (err) reject(err);

                        user.roles.shopper = shopper._id;
                        user.save(function(err, user) {
                            if (err) reject(err);

                            resolve(shopper);
                        });
                    });
                });
            } else {
                Shopper.create(fieldsToSet, function(err, shopper) {
                    if (err) reject(err);

                    user.roles.shopper = shopper._id;
                    user.save(function(err, user) {
                        if (err) reject(err);

                        resolve(shopper);
                    });
                });
            }
        }, function(err) {
            reject(err);
        });
    });
}

export function createDelegate(delegateObject, merchantId) {

    return new Promise(function(resolve, reject) {
        Merchant.findOne({
            _id: merchantId
        }, function(err, merchant) {
            if (err) {
                reject(err);
            }
            if (!merchant) {
                reject('Invalid Merchant Id' + merchantId);
            }

            createUser(delegateObject).then(function(user) {
                let fieldsToSet = {
                    user: user._id,
                    company: {
                        id: merchantId
                    },
                    phone: delegateObject.phone,
                    title: delegateObject.title,
                    firstName: delegateObject.firstName,
                    lastName: delegateObject.lastName
                };

                fieldsToSet.roles = Object.keys(delegateObject.roles).map(function(key) {
                    return {
                        name: key,
                        permit: true
                    }
                }) || [];

                if (config.requireAccountVerification) {
                    User.createVerificationToken((err, token, hash) => {
                        if (err) reject(err);
                        fieldsToSet.isVerified = false;
                        fieldsToSet.verificationToken = hash;

                        Delegate.create(fieldsToSet, function(err, delegate) {
                            if (err) {
                                reject(err);
                            }

                            merchant.delegates.push(user);
                            merchant.save(function(err, merchant) {
                                user.roles.delegate = delegate._id;
                                user.save(function(err, user) {
                                    if (err) reject(err);
                                    user.roles.delegate = delegate;
                                    resolve({...user.toJSON(), delegate: delegate, merchantId: merchant.user, verificationToken: delegate.verificationToken
                                    });
                                });
                            });
                        });
                    });
                } else {
                    Delegate.create(fieldsToSet, function(err, delegate) {
                        if (err) {
                            reject(err);
                        }

                        merchant.delegates.push(user);
                        merchant.save(function(err, merchant) {
                            user.roles.delegate = delegate._id;
                            user.save(function(err, user) {
                                if (err) reject(err);
                                user.roles.delegate = delegate;
                                resolve({...user.toJSON(), delegate: delegate, merchantId: merchant.user
                                });
                            });
                        });
                    });
                }



            }, function(err) {
                reject(err);
            });
        });
    });
}

export function logUserIn(email, password) {
    return new Promise(function(resolve, reject) {
        let regex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        let matchFields;

        if (!regex.test(email)) {
            //resort to username login
            matchFields = {
                username: email
            }
        } else {
            matchFields = {
                email: email
            }
        }

        getUserType(matchFields).then(function(type) {
            //edit user return values
            User.findOne(matchFields).populate({
                path: `roles.${type}`
            }).exec(function(err, user) {
                if (err) {
                    reject(err);
                }

                if (!user) {
                    reject('user_not_found');
                }

                User.validatePassword(password, user.password, function(err, res) {
                    if (err) {
                        reject(err);
                    }

                    if (!res) {
                        return reject('user_password_wrong');
                    }

                    //create jwt token
                    jwt.sign(user.toObject(), config.secret, {
                        algorithm: 'HS256',
                        expiresIn: '7d'
                    }, function(token) {
                        //return token
                        return resolve({
                            user: user,
                            token: token
                        });
                    });
                });
            });
        }, function(err) {
            reject(err);
        });
    });
}

export function deleteUser(userId, password, acToDelete) {
    /*
        userId: user_id of account to delete or account issuing the delete
        password of account issuing the delete
        acToDelete:optional: user_id of account to delete in case one is deleting another account
    */

    /*
        scenarios: admin deleting another account
            if admin is deleting account ....
                if the account is an admin account, the admin must have access to adminAccounts
                                    user account, the admin must have access to userAccounts
        merchant deleting delegate
            merchant must be owner of delegate
        merchant deleting store account
            delete merchant
            delete all delegates associated to merchant
        shopper deleting his account
        delegate can only be deleted by shopowner or merchant
            if delegate return error - can only be deleted by merchant
    */

    return new Promise(function(resolve, reject) {
        User.findOne(userId, function(err, issuer) {
            if (err) return reject(err);

            if (!issuer) return reject('user_not_found');

            //validate password
            User.validatePassword(password, issuer.password, function(err, res) {
                if (err) return reject(err);

                if (!res) {
                    return reject('incorrect_password');
                }

                getUserType({
                    _id: issuer._id
                }).then(function(type) {
                    //fetch user...validate password or do so individually for each case..tedious
                    switch (type.toUpperCase()) {
                        case 'ADMIN':
                            Admin.findOne({
                                _id: issuer.roles[type]
                            }, function(err, bAdmin) {
                                if (acToDelete) {
                                    getUserType({
                                        _id: acToDelete
                                    }).then(function(_type) {
                                        switch (_type.toUpperCase()) {
                                            case 'ADMIN':
                                                if (err) return reject(err);

                                                let hasAdminPermission = bAdmin.hasPermissionTo('adminAccounts');
                                                if (hasAdminPermission) {
                                                    //go ahead and delete account
                                                    User.findOne({
                                                        _id: acToDelete
                                                    }, function(err, sAdmin) {
                                                        if (err) return reject(err);
                                                        User.remove({
                                                            _id: acToDelete
                                                        }, function(err, removeCount) {
                                                            if (err) return reject(err);

                                                            if (removeCount) {
                                                                mongoose.model(toTitleCase(_type)).findOne({
                                                                    _id: sAdmin.roles[_type]
                                                                }).remove(function(err, res) {
                                                                    if (err) return reject('delete_failed');
                                                                    return resolve({
                                                                        message: 'success'
                                                                    });
                                                                });
                                                            } else {
                                                                return resolve({
                                                                    message: 'no account deleted'
                                                                });
                                                            }
                                                        });
                                                    });
                                                } else {
                                                    return reject('unauthorized');
                                                }
                                                break;
                                            case 'MERCHANT':
                                                //admin must have userAccounts permissions
                                                let hasUserPermission = bAdmin.hasPermissionTo('userAccounts');
                                                if (hasUserPermission) {
                                                    User.findOne({
                                                        _id: acToDelete
                                                    }, function(err, merchant) {
                                                        if (err) {
                                                            reject(err);
                                                        }

                                                        Merchant.remove({
                                                            _id: merchant.roles[_type]
                                                        }, function(err, removeCount) {
                                                            if (!removeCount) {
                                                                reject('delete_failed');
                                                            }

                                                            mongoose.model('Delegate').find({
                                                                'company.id': merchant.roles[type]
                                                            }).remove(function(err, removeCount) {
                                                                if (err) return reject(err);
                                                                resolve({
                                                                    message: 'success'
                                                                });
                                                            });
                                                        });
                                                    });
                                                } else {
                                                    return reject('unauthorized');
                                                }
                                                break;
                                            case 'SHOPPER':
                                            case 'DELEGATE':
                                                //admin must have user accounts permissions
                                                if (hasUserPermission) {
                                                    User.remove({
                                                        _id: acToDelete
                                                    }, function(err, removeCount) {
                                                        if (err) return reject(err);

                                                        if (removeCount) {
                                                            mongoose.model(toTitleCase(type)).findOne({
                                                                _id: issuer.roles[type]
                                                            }).remove(function(err, res) {
                                                                if (err) return reject('delete_failed');
                                                                return resolve({
                                                                    message: 'success'
                                                                });
                                                            });
                                                        } else {
                                                            return resolve({
                                                                message: 'Delete failed. No user match'
                                                            });
                                                        }
                                                    });
                                                } else {
                                                    return reject('unauthorized');
                                                }
                                                break;
                                            default:
                                                break;
                                        }
                                    }, function(err) {
                                        return reject(err);
                                    });
                                } else {
                                    //admin is deleting own account..impossible..unless deleted by another admin 
                                    return reject('Administrator cannot delete own account');
                                }
                            });
                            break;
                        case 'MERCHANT':
                            if (acToDelete) {
                                //merchant is deleting delegate..make sure delegate company id matches merchant id
                            } else {
                                //merchant is deleting own account..delete account..delete all delegates
                                User.remove({
                                    _id: userId
                                }, function(err, removeCount) {
                                    if (err) {
                                        reject(err);
                                    }
                                    if (!removeCount) {
                                        reject('delete_failed');
                                    }

                                    //edit after deleting merchant account
                                    mongoose.model(toTitleCase(type)).findOne({
                                        _id: issuer.roles[type]
                                    }, function(err, merchant) {
                                        if (err) return reject(err);

                                        mongoose.model('Delegate').find({
                                            'company.id': merchant._id
                                        }).remove(function(err, removeCount) {
                                            if (err) return reject(err);
                                            resolve({
                                                message: 'success'
                                            });
                                        });
                                    });
                                });
                            }
                            break;
                        case 'SHOPPER':
                            User.remove({
                                _id: issuer._id
                            }, function(err, result) {
                                if (err) reject('delete_failed');
                                //delete account
                                mongoose.model(toTitleCase(type)).findOne({
                                    _id: issuer.roles[type]
                                }).remove(function(err, res) {
                                    if (err) return reject('delete_failed');
                                    return resolve({
                                        message: 'success'
                                    });
                                });
                            });
                            break;
                        default:
                            return reject('delete failed');
                    }
                }, function(err) {
                    reject(err);
                });
            });
        });
    });
}

export function editUser(userId, fieldsToEdit, acToEdit) {
    /*
       userId: user_id of initiator of edit
       acToEdit: user_id of account to edit
       fieldsToEdit: fields of account to edit 

       possible edit scenarios:
       admin adding roles to another admin => must have admin accounts permission
       admin editing other accounts => adding roles to delegates, etc
       admin resetting passwords of other users

       merchants adding roles to delegates
       other accounts editing themselves
    */

    return new Promise(function(resolve, reject) {

        //do validation here
        if (fieldsToEdit.hasOwnProperty('username')) {
            duplicateUsernameCheck(fieldsToEdit).then(function(res) {
                //do nothing - continue
            }, function(err) {
                //remove username when bubbling results
                return reject(err);
            });
        }

        if (fieldsToEdit.hasOwnProperty('email')) {
            duplicateEmailCheck(fieldsToEdit).then(function(res) {
                //do nothing - continue
            }, function(err) {
                return reject(err);
            });
        }

        getUserType({
            _id: userId
        }).then(function(type) {
            switch (type.toUpperCase()) {
                case 'ADMIN':
                    if (acToEdit) {
                        //get account to edit type
                        getUserType({
                            _id: acToEdit
                        }).then(function(_type) {

                            let permit = false;

                            User.findOne(userId, function(err, adminuser) {
                                if (err) return reject(err);

                                if (!adminuser) return reject('Admin with corresponding ID not found');
                                Admin.findOne(adminuser.roles.admin, function(err, admin) {
                                    if (err) return reject(err);

                                    if (_type === 'admin') {
                                        if (admin.hasPermissionTo('adminAccounts')) {
                                            permit = true;
                                        }
                                    } else {
                                        if (admin.hasPermissionTo('userAccounts')) {
                                            permit = true;
                                        }
                                    }

                                    if (fieldsToEdit.hasOwnProperty('password')) {
                                        let params = {
                                            id: acToEdit,
                                            isAdminResetPassword: true,
                                            newPass: fieldsToEdit.password
                                        };

                                        if (permit) {
                                            User.resetPassword(params, function(err, res) {
                                                if (err) return reject(err);

                                                delete fieldsToEdit.password;
                                            });
                                        } else {
                                            reject('unauthorized_to_reset_password');
                                        }
                                    }

                                    let indirectEdits = {};
                                    switch (_type.toUpperCase()) {
                                        case 'ADMIN':
                                            if (fieldsToEdit.hasOwnProperty('permissions')) {
                                                //validate roles..if not exist..delete from fieldToEdit.roles
                                                let validPermissions = fieldsToEdit.permissions.filter(function(permission) {
                                                    return adminPermissions.indexOf(permission.name) !== -1;
                                                });
                                                indirectEdits.permissions = validPermissions;
                                                delete fieldsToEdit.permissions;
                                            }

                                            if (permit) {
                                                User.findByIdAndUpdate(acToEdit, fieldsToEdit, {
                                                        new: true
                                                    },
                                                    function(err, updatedAdmin) {
                                                        if (err) return reject(err);

                                                        Admin.findByIdAndUpdate(updatedAdmin.roles.admin, fieldsToEdit, {
                                                                new: true
                                                            },
                                                            function(err, res) {
                                                                if (err) return reject(err);

                                                                if (indirectEdits.hasOwnProperty('permissions')) {
                                                                    res.permissions = indirectEdits.permissions;
                                                                    res.save(function(err, updatedDoc) {
                                                                        if (err) return reject(err);
                                                                        updatedAdmin.roles.admin = updatedDoc;
                                                                        return resolve({
                                                                            message: 'success',
                                                                            type: 'adminEditUser',
                                                                            user: updatedAdmin
                                                                        });
                                                                    });
                                                                } else {
                                                                    updatedAdmin.roles.admin = res;
                                                                    return resolve({
                                                                        message: 'success',
                                                                        type: 'adminEditUser',
                                                                        user: updatedAdmin
                                                                    });
                                                                }
                                                            });
                                                    });
                                            } else {
                                                return reject('unauthorized');
                                            }
                                            break;
                                        case 'DELEGATE':
                                            //perform role validate if role exists
                                            if (fieldsToEdit.hasOwnProperty('roles')) {
                                                let validRoles = fieldsToEdit.roles.filter(function(role) {
                                                    return delegateRoles.indexOf(role.name) !== -1;
                                                });
                                                indirectEdits.roles = validRoles;
                                                delete fieldsToEdit.roles;
                                            }

                                            if (permit) {
                                                User.findByIdAndUpdate(acToEdit, fieldsToEdit, {
                                                        new: true
                                                    },
                                                    function(err, updatedDelegate) {
                                                        if (err) return reject(err);
                                                        Delegate.findByIdAndUpdate(updatedDelegate.roles.delegate, fieldsToEdit, {
                                                            new: true
                                                        }, function(err, res) {
                                                            if (err) return reject(err);
                                                            //do role update
                                                            if (indirectEdits.hasOwnProperty('roles')) {
                                                                res.roles = indirectEdits.roles;
                                                                res.save(function(err, updated) {
                                                                    if (err) return reject(err);

                                                                    updatedDelegate.roles.delegate = updated;
                                                                    return resolve({
                                                                        message: 'update_success',
                                                                        type: 'adminEditUser',
                                                                        user: updatedDelegate
                                                                    });
                                                                });
                                                            } else {
                                                                updatedDelegate.roles.delegate = res;
                                                                return resolve({
                                                                    message: 'update_success',
                                                                    type: 'adminEditUser',
                                                                    user: updatedDelegate
                                                                });
                                                            }
                                                        });
                                                    });
                                            } else {
                                                return reject('unauthorized');
                                            }
                                            break;
                                        default:
                                            //admin is editing either shopper or merchant
                                            if (permit) {
                                                User.findByIdAndUpdate(acToEdit, fieldsToEdit, {
                                                    new: true
                                                }, function(err, updatedUser) {
                                                    if (err) return reject(err);
                                                    mongoose.model(toTitleCase(_type)).findByIdAndUpdate(updatedUser.roles[_type], fieldsToEdit, {
                                                        new: true
                                                    }, function(err, updatedUserObj) {
                                                        if (err) return reject(err);

                                                        updatedUser.roles[_type] = updatedUserObj;
                                                        return resolve({
                                                            message: 'update_success',
                                                            type: 'adminEditUser',
                                                            user: updatedUser
                                                        });
                                                    });
                                                });
                                            } else {
                                                return reject('unauthorized');
                                            }
                                            break;
                                    }
                                });
                            });
                        }, function(err) {
                            return reject(err);
                        });
                    } else {
                        //admin is editing his own account..perform edit..
                        //admin with adminAccount permmissions can add or remove roles for himself
                        //only admin with adminAccount permissions can change his password directly
                        let indirectEdits = {};

                        if (fieldsToEdit.hasOwnProperty('password')) {
                            indirectEdits.password = fieldsToEdit.password;
                            delete fieldsToEdit.password;
                        }

                        if (fieldsToEdit.hasOwnProperty('permissions')) {
                            //validate roles..if not exist..delete from fieldToEdit.roles
                            let validPermissions = fieldsToEdit.permissions.filter(function(permission) {
                                return adminPermissions.indexOf(permission.name) !== -1;
                            });
                            indirectEdits.permissions = validPermissions;
                            delete fieldsToEdit.permissions;
                        }

                        User.findByIdAndUpdate(userId, fieldsToEdit, {
                            new: true
                        }, function(err, updatedUser) {
                            if (err) return reject(err);

                            const adminId = (typeof updatedUser.roles.admin === 'object') ? updatedUser.roles.admin._id:
                                            updatedUser.roles.admin;

                            Admin.findByIdAndUpdate(adminId, fieldsToEdit, function(err, updateAdmin) {
                                if (err) return reject(err);
                                let hasAdminPermission = updateAdmin.hasPermissionTo('adminAccounts');

                                if (hasAdminPermission) {
                                    if (indirectEdits.hasOwnProperty('permissions')) {
                                        updateAdmin.permissions = indirectEdits.permissions;

                                        updateAdmin.save(function(err, updatedAdmin) {
                                            if (err) return reject(err);
                                            updateAdmin = updatedAdmin;
                                        });
                                    }

                                    if (indirectEdits.hasOwnProperty('password')) {
                                        let params = {
                                            id: userId,
                                            isAdminResetPassword: true,
                                            newPass: indirectEdits.password
                                        };

                                        User.resetPassword(params, function(err, res) {
                                            if (err) return reject(err);
                                        });
                                    }

                                    updatedUser.roles.admin = updateAdmin;
                                    jwt.sign(updatedUser.toObject(), config.secret, {
                                        algorithm: 'HS256',
                                        expiresIn: '7d'
                                    }, function(token) {
                                        //return token
                                        return resolve({
                                            user: updatedUser,
                                            token: token,
                                            message: 'update_success'
                                        });
                                    });

                                } else {
                                    updatedUser.roles.admin = updateAdmin;
                                    jwt.sign(updatedUser.toObject(), config.secret, {
                                        algorithm: 'HS256',
                                        expiresIn: '7d'
                                    }, function(token) {
                                        //return token
                                        return resolve({
                                            user: updatedUser,
                                            token: token,
                                            message: 'update_success'
                                        });
                                    });
                                }
                            });
                        });
                    }
                    break;
                case 'MERCHANT':
                    if (fieldsToEdit.hasOwnProperty('password')) {
                        //add password error to return object
                        delete fieldsToEdit.password;
                    }

                    if (acToEdit) {
                        //merchant is editing store delegates
                        //check to see if merchant owns delegate
                        let indirectEdits = {};
                        if (fieldsToEdit.hasOwnProperty('roles')) {
                            //merchant is adding roles to delegate...validate role..then add
                            let validRoles = fieldsToEdit.roles.filter(function(role) {
                                return delegateRoles.indexOf(role.name) !== -1;
                            });
                            indirectEdits.roles = validRoles;
                            delete fieldsToEdit.roles;
                        }

                        User.findByIdAndUpdate(acToEdit, fieldsToEdit, {
                            new: true
                        }, function(err, user) {
                            if (err) return reject(err);


                            Delegate.findByIdAndUpdate(user.roles.delegate, fieldsToEdit, {
                                    new: true
                                },
                                function(err, delegate) {
                                    if (err) return reject(err);

                                    if (indirectEdits.hasOwnProperty('roles')) {
                                        delegate.roles = indirectEdits.roles;
                                        delegate.save(function(err, changedDelegate) {
                                            if (err) return reject(err);
                                            user.roles.delegate = changedDelegate;
                                            return resolve({
                                                message: 'update_success',
                                                delegate: user,
                                                type: 'merchantEditDelegate'
                                            });
                                        });
                                    } else {
                                        user.roles.delegate = delegate;
                                        return resolve({
                                            message: 'update_success',
                                            delegate: user,
                                            type: 'merchantEditDelegate'
                                        });
                                    }
                                });
                        });
                    } else {
                        //merchant is editing his own account
                        User.findByIdAndUpdate(userId, fieldsToEdit, {
                            new: true
                        }, function(err, updatedMerchant) {
                            if (err) return reject(err);

                            Merchant.findByIdAndUpdate(updatedMerchant.roles.merchant,
                                fieldsToEdit, {
                                    new: true,
                                    populate: {
                                        path: 'delegates'
                                    }
                                },
                                function(err, res) {
                                    if (err) return reject(err);
                                    updatedMerchant.roles.merchant = res;
                                    jwt.sign(updatedMerchant.toObject(), config.secret, {
                                        algorithm: 'HS256',
                                        expiresIn: '7d'
                                    }, function(token) {
                                        //return token
                                        return resolve({
                                            user: updatedMerchant,
                                            token: token,
                                            message: 'update_success'
                                        });
                                    });
                                });
                        });
                    }
                    break;
                default:
                    if (fieldsToEdit.hasOwnProperty('password')) {
                        //regular user cant edit his own password
                        delete fieldsToEdit.password;
                    }
                    if (fieldsToEdit.hasOwnProperty('roles')) {
                        //regular user cant edit roles
                        delete fieldsToEdit.roles;
                    }

                    User.findByIdAndUpdate(userId, fieldsToEdit, {
                            new: true
                        },
                        function(err, updatedUser) {
                            if (err) return reject(err);

                            mongoose.model(toTitleCase(type)).findByIdAndUpdate(updatedUser.roles[type], fieldsToEdit, {
                                    new: true
                                },
                                function(err, updatedUserObj) {
                                    if (err) return reject(err);

                                    updatedUser.roles[type] = updatedUserObj;

                                    jwt.sign(updatedUser.toObject(), config.secret, {
                                        algorithm: 'HS256',
                                        expiresIn: '7d'
                                    }, function(token) {
                                        //return token
                                        return resolve({
                                            user: updatedUser,
                                            token: token,
                                            message: 'update_success'
                                        });
                                    });
                                });
                        });
                    break;
            }
        }, function(err) {
            return reject(err);
        });
    });
}

export function getUserType(matchBy) {
    return new Promise(function(resolve, reject) {
        User.findOne(matchBy, function(err, user) {
            if (err) {
                return reject('user_fetch_failed');
            }
            if (!user) {
                return reject('user_not_found');
            }
            Object.keys(user.roles.toJSON()).map(function(key) {
                if (user.roles[key]) {
                    return resolve(key);
                }
            });
            return reject('undefined_user_type');
        });
    });
}

export function hasErrors(object) {
    if (object == null || typeof object === 'undefined') {
        return false;
    }
    return object.errors.length > 0 || Object.keys(object.errFor).length > 0;
}

export function resetOutcome() {
    outcome.success = false;
    outcome.errors = [];
    outcome.errFor = {};

    return;
}
