/**
 * Copyright (c) Microsoft Corporation
 * All rights reserved. See License.txt in the project root for license information.
 * ISearchResultContainer containerModule Interface Properties
 * THIS FILE IS AUTO-GENERATED - MANUAL MODIFICATIONS WILL BE LOST
 */

import * as Msdyn365 from '@msdyn365-commerce/core';
import * as React from 'react';

export const enum expandRefinersCount {
    all = 'all',
    one = 'one',
    two = 'two',
    three = 'three',
    four = 'four'
}

export interface ISearchResultContainerConfig extends Msdyn365.IModuleConfig {
    itemsPerPage?: number;
    allowBackNavigation?: boolean;
    imageSettings?: Msdyn365.IImageSettings;
    expandRefinersCount?: expandRefinersCount;
    disableHierarchy?: boolean;
    includeAttributes?: boolean;
    enableAffiliationBasedPricing?: boolean;
    updateRefinerPanel?: boolean;
    className?: string;
    clientRender?: boolean;
}

export interface ISearchResultContainerResources {
    noResultsForRefinersText: string;
    resultCategoryNotFoundText: string;
    resultSearchNotFoundText: string;
    paginationAriaLabel: string;
    priceFree: string;
    priceRangeSeparator: string;
    originalPriceText: string;
    currentPriceText: string;
    ratingAriaLabel: string;
    flipperNext: string;
    flipperPrevious: string;
    searchTextPrefix: string;
    numberOfProducts: string;
    oneProduct: string;
    categoryLinkAriaLabel: string;
    sortByDropdownLabel: string;
    sortByOptionNameAsc: string;
    sortByOptionNameDesc: string;
    sortByOptionPriceAsc: string;
    sortByOptionPriceDesc: string;
    sortByOptionRatingDesc: string;
    sortByOptionBestSelling: string;
    sortByOptionNewScore: string;
    sortByOptionTrendingScore: string;
    sortByOptionRelevanceDesc: string;
    placeholderTextMax: string;
    minLabel: string;
    maxLabel: string;
    rangeNameFormat: string;
    validationErrorNotNumber: string;
    validationErrorNotRange: string;
    clearAllText: string;
    choiceSummaryLabel: string;
    choiceFormat: string;
    choiceRangeValueFormat: string;
    choiceAriaLabel: string;
    closeAriaLabel: string;
    modalTitle: string;
    modalCloseButtonText: string;
    minValueSliderThumbAriaLabel: string;
    maxValueSliderThumbAriaLabel: string;
    featureSimilarLooksTitle: string;
    featureSimilarDescriptionTitle: string;
    productCountAriaLabel: string;
    singleProductCountAriaLabel: string;
    swatchItemAriaLabel: string;
    refineItemsAriaLabel: string;
    refineItemAriaLabel: string;
}

export interface ISearchResultContainerProps<T> extends Msdyn365.IModule<T> {
    resources: ISearchResultContainerResources;
    config: ISearchResultContainerConfig;
    slots: {
        quickview: React.ReactNode[];
        productComparisonButton: React.ReactNode[];
    };
}
