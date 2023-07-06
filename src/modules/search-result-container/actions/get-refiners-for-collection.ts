/*!
 * Copyright (c) Microsoft Corporation.
 * All rights reserved. See LICENSE in the project root for license information.
 */

/* eslint-disable no-duplicate-imports */
import { IProductRefinerHierarchy } from '@msdyn365-commerce/commerce-entities';
import { createObservableDataAction, IAction, IActionContext, IActionInput, ICreateActionContext } from '@msdyn365-commerce/core';
import { AsyncResult, ChannelInventoryConfiguration, ProductRefinerValue, ProductSearchCriteria } from '@msdyn365-commerce/retail-proxy';
import { getInventoryConfigurationAsync } from '@msdyn365-commerce/retail-proxy/dist/DataActions/StoreOperationsDataActions.g';

import { BaseCollectionInput, createBaseCollectionInput } from './base-collection-action';
import { getProductRefinerHierarchy } from './get-product-refiner-hierarchy';
import { getInventoryRefinerAction, InventoryInStockRefinerValueInput, ProductListInventoryFilteringOptions } from '../actions';

/**
 * Default Category/Product Id Values.
 */
enum DefaultValues {
    defaultCategoryIdValue = 0,
    defaultProductIdValue = 0
}

/**
 * Refiners-by-Collection Input action.
 */
export class RefinersByCollectionInput extends BaseCollectionInput implements IActionInput {
    public getCacheObjectType = () => 'ProductRefiner';

    public dataCacheType = () => {
        if (
            this.pageType !== 'Category' ||
            (this.refiners && this.refiners.length > 0) ||
            (this.queryResultSettings &&
                this.queryResultSettings.Sorting &&
                this.queryResultSettings.Sorting.Columns &&
                this.queryResultSettings.Sorting.Columns.length > 0)
        ) {
            return 'request';
        }
        return 'application';
    };
}

/**
 * Create input method which creates an ActionInput for fetching list page refiners.
 * @param args
 */
const createInput = (args: ICreateActionContext): IActionInput => {
    return createBaseCollectionInput(args, RefinersByCollectionInput);
};

/**
 * Returns inventory in stock refiner value.
 * @param  input - The inventory refiner input.
 * @param  context - The request context.
 * @param  channelInventoryConfiguration - The channelInventoryConfiguration.
 * @returns Refiners.
 */
async function getInventoryInStockRefinerValueAsync(
    input: RefinersByCollectionInput,
    context: IActionContext,
    channelInventoryConfiguration: ChannelInventoryConfiguration
): Promise<ProductRefinerValue | null> {
    let inventoryRefiner = input.inventoryRefiner;
    // For hydrate, the inventory refiner is not added on input parameter, need to query the inventory refiner
    // For reaction in browser, the inventory refiner is added in componentDidMount of search-result-container
    if (!inventoryRefiner) {
        const refinerInput = new InventoryInStockRefinerValueInput(input, channelInventoryConfiguration.InventoryProductAttributeRecordId);
        inventoryRefiner = await getInventoryRefinerAction(refinerInput, context);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- inventoryRefiner may be null
    return (
        inventoryRefiner?.Values.find(
            value =>
                value.LeftValueBoundString !== channelInventoryConfiguration.InventoryOutOfStockAttributeValueText &&
                value.RightValueBoundString !== channelInventoryConfiguration.InventoryOutOfStockAttributeValueText
        ) ?? null
    );
}

/**
 * Action method which fetches refiners for the given list page.
 * @param input
 * @param context
 */
async function action(input: RefinersByCollectionInput, context: IActionContext): Promise<IProductRefinerHierarchy[]> {
    let searchProductId;
    const refiners: ProductRefinerValue[] = input.refiners || [];

    if (context.requestContext.app.config?.productListInventoryDisplay === ProductListInventoryFilteringOptions.HideOOS) {
        let channelInventoryConfigurationPromise: AsyncResult<ChannelInventoryConfiguration>;
        if (input.channelInventoryConfiguration) {
            channelInventoryConfigurationPromise = AsyncResult.resolve(input.channelInventoryConfiguration);
        } else {
            channelInventoryConfigurationPromise = getInventoryConfigurationAsync({ callerContext: context });
        }
        const channelInventoryConfiguration = await channelInventoryConfigurationPromise;
        const inventoryInStockRefinerValue = await getInventoryInStockRefinerValueAsync(input, context, channelInventoryConfiguration);

        const isInventoryInStockRefinerValueExist = refiners.some(
            refiner => refiner.RefinerRecordId === inventoryInStockRefinerValue?.RefinerRecordId
        );
        if (!isInventoryInStockRefinerValueExist && inventoryInStockRefinerValue) {
            refiners.push(inventoryInStockRefinerValue);
        }
    }

    if (input.pageType === 'Category') {
        if (input.category) {
            return getProductRefinerHierarchy(
                {
                    CategoryIds: [input.category || DefaultValues.defaultCategoryIdValue],
                    Context: {
                        ChannelId: input.apiSettings.channelId,
                        CatalogId: input.catalogId
                    },
                    Refinement: input.isUpdateRefinerPanel ? refiners : []
                },
                input.queryResultSettings,
                context
            );
        }
        throw new Error('[GetRefinersForCollection]Category Page Detected, but no global categoryId found');
    } else {
        if (input.searchText && context.requestContext.query && context.requestContext.query.q) {
            return getProductRefinerHierarchy(
                {
                    SearchCondition: input.searchText,
                    Context: {
                        ChannelId: input.apiSettings.channelId,
                        CatalogId: input.catalogId
                    },
                    Refinement: input.isUpdateRefinerPanel ? refiners : []
                },
                input.queryResultSettings,
                context
            );
        }
        if (input.searchText && context.requestContext.query && context.requestContext.query.recommendation) {
            const searchObject = JSON.parse(input.searchText);
            if (context.requestContext.query.productId) {
                searchProductId = Number(searchObject.ProductId);
            }
            if (Number.isNaN(searchProductId)) {
                throw new Error('Failed to cast search product id into a number.');
            } else if (!searchObject.Recommendation) {
                throw new Error('Failed to retrieve the Recommendation.');
            } else {
                const searchCriteriaInput: ProductSearchCriteria = {};
                searchCriteriaInput.Context = {
                    ChannelId: input.apiSettings.channelId,
                    CatalogId: input.catalogId
                };
                searchCriteriaInput.Refinement = input.isUpdateRefinerPanel ? refiners : [];
                searchCriteriaInput.RecommendationListId = searchObject.Recommendation;
                if (searchProductId) {
                    searchCriteriaInput.Ids = [searchProductId || DefaultValues.defaultProductIdValue];
                }
                return getProductRefinerHierarchy(searchCriteriaInput, input.queryResultSettings, context);
            }
        } else {
            throw new Error('[GetFullProductsForCollection]Search Page Detected, but no q= or productId= query parameter found');
        }
    }
}

export const actionDataAction = createObservableDataAction({
    id: '@msdyn365-commerce-modules/search-result-container/get-refiners-for-collection',
    action: <IAction<IProductRefinerHierarchy[]>>action,
    input: createInput
});

export default actionDataAction;
