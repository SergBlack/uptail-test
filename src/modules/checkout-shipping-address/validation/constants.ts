import { AddressItemType, AddressValidationRuleType, IAddressValidationRule } from '@msdyn365-commerce-modules/address';

export const CUSTOM_VALIDATION_RULES: Record<number, Omit<IAddressValidationRule, 'message'>> = {
    [AddressItemType.Phone]: {
        type: AddressValidationRuleType.Format,
        regEx: '^$|^(444|555)[0-9]*$'
    }
};

export const DEFAULT_REQUIRED_FIELDS: AddressItemType[] = [
    AddressItemType.AddressTypeValue,
    AddressItemType.Name,
    AddressItemType.ZipCode,
    AddressItemType.City,
    AddressItemType.State,
    AddressItemType.ThreeLetterISORegionName,
    AddressItemType.Street,
    AddressItemType.Phone
];
