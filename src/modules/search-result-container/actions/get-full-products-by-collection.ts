/*!
 * Copyright (c) Microsoft Corporation.
 * All rights reserved. See LICENSE in the project root for license information.
 */

/* eslint-disable no-duplicate-imports */
import {
    CacheType,
    createObservableDataAction,
    IAction,
    IActionContext,
    IActionInput,
    ICreateActionContext
} from '@msdyn365-commerce/core';
import {
    AsyncResult,
    ChannelInventoryConfiguration,
    ProductRefinerValue,
    ProductSearchCriteria,
    ProductSearchResult
} from '@msdyn365-commerce/retail-proxy';
import { searchByCriteriaAsync } from '@msdyn365-commerce/retail-proxy/dist/DataActions/ProductsDataActions.g';
import { getInventoryConfigurationAsync } from '@msdyn365-commerce/retail-proxy/dist/DataActions/StoreOperationsDataActions.g';
import { ArrayExtensions, generateProductImageUrl, InventoryLevels } from '@msdyn365-commerce-modules/retail-actions';

import { BaseCollectionInput, createBaseCollectionInput } from './base-collection-action';
import getInventoryRefinerAction, { InventoryInStockRefinerValueInput } from './get-inventory-refiners';

/**
 * GetFullProductsByCollection Action Input.
 */
export class GetFullProductsByCollectionInput extends BaseCollectionInput implements IActionInput {
    /**
     * The cache object type.
     * @returns The cache object type.
     */
    public getCacheObjectType = (): string => 'FullProductSearchResult';

    /**
     * The data cache type.
     * @returns The data cache type.
     */
    public dataCacheType = (): CacheType => {
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
 * This setting defines inventory filtering options.
 */
export enum ProductListInventoryFilteringOptions {
    /**
     * Filter out all products out of stock.
     */
    HideOOS = 'hideOOS',

    /**
     * Sort products by availability, OOS goes last.
     */
    SortOOS = 'sortOOS',

    /**
     * No filtering selected.
     */
    Default = 'default'
}

/**
 * The full product search result with count interface.
 */
export interface IFullProductsSearchResultsWithCount {
    products: ProductSearchResult[];
    count: number;
    channelInventoryConfigurationId?: number;
    inventoryAwareSortableAttributeId?: number;
}

/**
 * CreateInput function which creates and actionInput used to fetch products for a list page.
 * @param args - The API arguments.
 * @returns IActionInput - The action input.
 */
const createInput = (args: ICreateActionContext<{ itemsPerPage: number; includedAttributes: boolean | undefined }>): IActionInput => {
    const input = createBaseCollectionInput(args, GetFullProductsByCollectionInput);

    // Set Top
    if (input.queryResultSettings.Paging && args.config) {
        input.queryResultSettings.Paging.Top = args.config.itemsPerPage || 1;
    }

    // Set Skip
    if (input.queryResultSettings.Paging && args.requestContext.query && args.requestContext.query.skip) {
        input.queryResultSettings.Paging.Skip = +args.requestContext.query.skip;
    }

    input.queryResultSettings.count = true;

    return input;
};

/**
 * Returns inventory in stock refiner value.
 * @param  input - The inventory refiner input.
 * @param  context - The request context.
 * @param  channelInventoryConfiguration - The channelInventoryConfiguration.
 * @returns Refiners.
 */
async function getInventoryInStockRefinerValueAsync(
    input: GetFullProductsByCollectionInput,
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
 * Returns list of products based on inventory information.
 * @param  productSearchResults - The products.
 * @param  context - The context.
 * @param  metadataCount - The metadata count.
 * @param channelInventoryConfiguration - The channel inventory configuration.
 * @returns List of product based on the inventory information.
 */
export async function returnProducts(
    productSearchResults: ProductSearchResult[],
    context: IActionContext,
    metadataCount: number | undefined,
    channelInventoryConfiguration?: ChannelInventoryConfiguration
): Promise<IFullProductsSearchResultsWithCount> {
    const defaultProductCount: number = 0;

    const productSearchResultsWithImages = productSearchResults.map(productSearchResult => {
        const newImageUrl = generateProductImageUrl(productSearchResult, context.requestContext.apiSettings);

        if (newImageUrl) {
            productSearchResult.PrimaryImageUrl = newImageUrl;
        }

        return productSearchResult;
    });

    // If inventory level is threshold or inventory check is disabled then return the list of products without the inventory configuration
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- read config file.
    if (
        context.requestContext.app.config.inventoryLevel === InventoryLevels.threshold ||
        context.requestContext.app.config.enableStockCheck === false
    ) {
        return {
            products: productSearchResultsWithImages,
            count: metadataCount ?? defaultProductCount
        };
    }

    const mappedProducts = productSearchResultsWithImages.map(productSearchResult => {
        if (ArrayExtensions.hasElements(productSearchResult.AttributeValues)) {
            for (const element of productSearchResult.AttributeValues) {
                if (
                    channelInventoryConfiguration &&
                    element.RecordId !== undefined &&
                    element.RecordId === channelInventoryConfiguration.InventoryProductAttributeRecordId &&
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- read config file.
                    context.requestContext.app.config.inventoryRanges !== 'all' &&
                    element.TextValue !== channelInventoryConfiguration.InventoryOutOfStockAttributeValueText
                ) {
                    // If same RecordId then it means that is the Inventory attribute
                    // Based on the inventory range (and filtering options), the inventory label will be displayed
                    // If Inventory range is 'All' then in stock and out of stock labels are shown, else only OOS
                    // if the text value is different that the channelInventoryConfiguration.InventoryOutOfStockAttributeValueText then is in stock
                    element.TextValue = '';
                }
            }
        }

        return productSearchResult;
    });

    return {
        products: mappedProducts,
        count: metadataCount ?? defaultProductCount,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- check config.
        channelInventoryConfigurationId: channelInventoryConfiguration
            ? channelInventoryConfiguration.InventoryProductAttributeRecordId
            : undefined,
        inventoryAwareSortableAttributeId: channelInventoryConfiguration
            ? channelInventoryConfiguration.ProductAvailabilitySortableAttributeRecordId
            : undefined
    };
}

/**
 * Action function to fetch products for a list page.
 * @param input - The input.
 * @param context - The context.
 * @returns IFullProductsSearchResultsWithCount - The full product search result with count.
 */
// eslint-disable-next-line complexity -- ignore the complexity.
async function action(input: GetFullProductsByCollectionInput, context: IActionContext): Promise<IFullProductsSearchResultsWithCount> {
    let promise: AsyncResult<ProductSearchResult[]>;
    let channelInventoryConfigurationPromise: AsyncResult<ChannelInventoryConfiguration>;
    let searchProductId;
    const searchCriteriaInput: ProductSearchCriteria = {};
    searchCriteriaInput.Context = { ChannelId: context.requestContext.apiSettings.channelId, CatalogId: input.catalogId };
    searchCriteriaInput.Refinement = input.refiners;
    searchCriteriaInput.IncludeAttributes = input.includeAttributes;
    searchCriteriaInput.SkipVariantExpansion = true;
    const defaultNumber: number = 0;

    if (input.channelInventoryConfiguration) {
        channelInventoryConfigurationPromise = AsyncResult.resolve(input.channelInventoryConfiguration);
    } else {
        channelInventoryConfigurationPromise = getInventoryConfigurationAsync({ callerContext: context });
    }
    const channelInventoryConfiguration = await channelInventoryConfigurationPromise;

    if (context.requestContext.app.config?.productListInventoryDisplay === ProductListInventoryFilteringOptions.HideOOS) {
        const inventoryInStockRefinerValue = await getInventoryInStockRefinerValueAsync(input, context, channelInventoryConfiguration);

        const isInventoryInStockRefinerValueExist = searchCriteriaInput.Refinement.some(
            refiner => refiner.RefinerRecordId === inventoryInStockRefinerValue?.RefinerRecordId
        );
        if (!isInventoryInStockRefinerValueExist && inventoryInStockRefinerValue) {
            searchCriteriaInput.Refinement.push(inventoryInStockRefinerValue);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- app configs are of generic type
    if (
        context.requestContext.app.config?.productListInventoryDisplay === ProductListInventoryFilteringOptions.SortOOS &&
        channelInventoryConfiguration.ProductAvailabilitySortableAttributeRecordId
    ) {
        input.queryResultSettings.Sorting = input.queryResultSettings.Sorting ?? {};
        input.queryResultSettings.Sorting.Columns = input.queryResultSettings.Sorting.Columns ?? [];
        const sortColumnName = `Attr_${channelInventoryConfiguration.ProductAvailabilitySortableAttributeRecordId}`;
        const isSortAttributeExist = input.queryResultSettings.Sorting.Columns.some(column => column.ColumnName === sortColumnName);
        if (!isSortAttributeExist) {
            input.queryResultSettings.Sorting.Columns.push({
                ColumnName: sortColumnName,
                IsDescending: true
            });
        }
    }

    if (input.pageType === 'Category' || context.requestContext.query?.categoryId) {
        if (input.category) {
            searchCriteriaInput.CategoryIds = [input.category || defaultNumber];
            promise = searchByCriteriaAsync(
                {
                    callerContext: context,
                    queryResultSettings: input.queryResultSettings
                },
                searchCriteriaInput
            );
        } else {
            throw new Error('[GetFullProductsForCollection]Category Page Detected, but no global categoryId found');
        }
    } else if (input.searchText && context.requestContext.query?.q) {
        searchCriteriaInput.SearchCondition = input.searchText;
        promise = searchByCriteriaAsync(
            {
                callerContext: context,
                queryResultSettings: input.queryResultSettings
            },
            searchCriteriaInput
        );
    } else if (input.searchText && context.requestContext.query && context.requestContext.query.recommendation) {
        const searchObject = JSON.parse(input.searchText);
        if (context.requestContext.query.productId) {
            searchProductId = Number(searchObject.ProductId);
        }
        if (Number.isNaN(searchProductId)) {
            throw new Error('Failed to cast search product id into a number.');
        } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Existing code
            !searchObject.Recommendation
        ) {
            throw new Error('Failed to retrieve the Recommendation.');
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Existing code
            searchCriteriaInput.RecommendationListId = searchObject.Recommendation;
            if (searchProductId) {
                searchCriteriaInput.Ids = [searchProductId || defaultNumber];
            }
            promise = searchByCriteriaAsync(
                {
                    callerContext: context,
                    queryResultSettings: input.queryResultSettings
                },
                searchCriteriaInput
            );
        }
    } else {
        throw new Error('[GetFullProductsForCollection]Search Page Detected, but no q= or productId= query parameter found');
    }

    const productSearchResults = await promise;
    return returnProducts(productSearchResults, context, promise.metadata.count, channelInventoryConfiguration);
}

export const actionDataAction = createObservableDataAction({
    id: '@msdyn365-commerce-modules/search-result-container/get-full-products-by-collection',
    action: action as IAction<IFullProductsSearchResultsWithCount>,
    input: createInput
});

export default actionDataAction;
