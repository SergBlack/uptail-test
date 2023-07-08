import { Address } from '@msdyn365-commerce/retail-proxy';
import { get, set } from 'mobx';
import { IAddressItem, IAddressValidationRule } from '@msdyn365-commerce-modules/address';

import { CUSTOM_VALIDATION_RULES } from './constants';

const validateRegEx = (address: Address, propertyName: string, validationRule: IAddressValidationRule): boolean => {
    if (validationRule.regEx && validationRule.regEx.length > 0) {
        const regex = new RegExp(validationRule.regEx);

        return regex.test((get(address, propertyName) as string) || '');
    }

    return true;
};

const inputValidation = (addressFormatItem: IAddressItem, validationError: Address, address: Address): boolean | undefined => {
    set(validationError, { [addressFormatItem.name]: null });

    for (const validationRule of addressFormatItem.validationRules || []) {
        // using custom validation rules map
        const customValidationRule = CUSTOM_VALIDATION_RULES[addressFormatItem.type];

        if (customValidationRule && validationRule.type === customValidationRule.type) {
            validationRule.regEx = customValidationRule.regEx;
        }

        if (!validateRegEx(address, addressFormatItem.name, validationRule)) {
            set(validationError, { [addressFormatItem.name]: validationRule.message });

            return false;
        }
    }

    return undefined;
};

/*
 * Validator customization from @msdyn365-commerce-modules/address/src/common/address-format.ts
 * */

export const validateAddressFormat = (
    address: Address,
    addressFormat: IAddressItem[],
    validationError: Address,
    propertyName?: string
): boolean => {
    let isValid: boolean = true;
    let validationtor;

    addressFormat.forEach(addressFormatItem => {
        if (!propertyName || (propertyName && addressFormatItem.name === propertyName)) {
            validationtor = inputValidation(addressFormatItem, validationError, address);

            if (validationtor !== undefined) {
                isValid = validationtor;
            }
        }
    });

    return isValid;
};
