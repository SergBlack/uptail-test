/*!
 * Copyright (c) Microsoft Corporation.
 * All rights reserved. See LICENSE in the project root for license information.
 */

/* eslint-disable no-duplicate-imports */
import { IProductRefinerHierarchy } from '@msdyn365-commerce/commerce-entities';
import { CacheType, createObservableDataAction, IAction, IActionContext, IActionInput } from '@msdyn365-commerce/core';
import { buildCacheKey } from '@msdyn365-commerce-modules/retail-actions';

import { BaseCollectionInput } from './base-collection-action';
import { getProductRefinerHierarchy } from './get-product-refiner-hierarchy';

/**
 * InventoryInStockRefinerValue Input action.
 */
export class InventoryInStockRefinerValueInput extends BaseCollectionInput implements IActionInput {
    public inventoryProductAttributeRecordId: number;

    public constructor(input: BaseCollectionInput, inventoryProductAttributeRecordId: number = 0) {
        super(
            input.pageType,
            input.apiSettings,
            {
                count: true
            },

            // Parameter - refiners
            [],

            // Parameter - category
            undefined,

            // Parameter - searchText
            '',

            // Parameter - includeAttributes
            false,

            // Parameter - isUpdateRefinerPanel
            false,

            // Parameter - locale
            undefined,
            input.catalogId,
            input.channelInventoryConfiguration,
            input.inventoryRefiner
        );

        this.inventoryProductAttributeRecordId =
            inventoryProductAttributeRecordId || input.channelInventoryConfiguration?.InventoryProductAttributeRecordId || 0;
    }

    /**
     * GetCacheKey.
     * @returns - Returns string.
     */
    public getCacheKey = (): string => buildCacheKey('RefinerList', this.apiSettings);

    /**
     * GetCacheObjectType.
     * @returns - Returns string.
     */
    public getCacheObjectType = (): string => 'RefinerList';

    /**
     * DataCacheType.
     * @returns - CacheType string.
     */
    public dataCacheType = (): CacheType => 'application';
}

/**
 * Action method returns inventory in stock refiners.
 * @param input - InventoryInStockRefinerValueInput.
 * @param context - IActionContext.
 * @returns - Promise<IProductRefinerHierarchy | null>.
 */
async function action(input: InventoryInStockRefinerValueInput, context: IActionContext): Promise<IProductRefinerHierarchy | null> {
    const refiners = await getProductRefinerHierarchy(
        {
            Context: {
                ChannelId: input.apiSettings.channelId,
                CatalogId: input.catalogId
            }
        },
        input.queryResultSettings,
        context
    );

    // InventoryProductAttributeRecordId may be 0, and recId of default refiner Category/Price/Rating is always 0 by design. In this case, we should not return refiner
    // Why recId of default refiner Category/Price/Rating is 0: see GetChannelProductRefiners.sql
    return (
        (input.channelInventoryConfiguration?.InventoryProductAttributeRecordId !== 0 &&
            refiners.find(refiner => refiner.RecordId === input.channelInventoryConfiguration?.InventoryProductAttributeRecordId)) ||
        // keep legacy logic to avoid break existing customers usage from this file
        (input.inventoryProductAttributeRecordId !== 0 &&
            refiners.find(refiner => refiner.RecordId === input.inventoryProductAttributeRecordId)) ||
        null
    );
}

/**
 * Action.
 * @param id - Id.
 * @param action - Action.
 * @returns - Results.
 */
export const actionDataAction = createObservableDataAction({
    id: '@msdyn365-commerce-modules/search-result-container/get-inventory-refiners',
    action: action as IAction<IProductRefinerHierarchy>
});

export default actionDataAction;
