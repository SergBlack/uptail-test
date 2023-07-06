/*!
 * Copyright (c) Microsoft Corporation.
 * All rights reserved. See LICENSE in the project root for license information.
 */

import { IProductsDimensionsAvailabilities } from '@msdyn365-commerce/commerce-entities';
import {
    getCatalogId,
    IComponent,
    IComponentProps,
    ICoreContext,
    IGridSettings,
    IImageData,
    IImageProps,
    IImageSettings,
    Image,
    IRequestContext,
    msdyn365Commerce
} from '@msdyn365-commerce/core';
import { AttributeSwatch, ProductDimension, ProductPrice, ProductSearchResult, SimpleProduct } from '@msdyn365-commerce/retail-proxy';
import {
    ArrayExtensions,
    checkIfShouldDisplayAsSwatch,
    convertDimensionTypeToProductDimensionType,
    Dictionary,
    DimensionSwatchDisplayTypes,
    DimensionTypes,
    generateImageUrl,
    getDeliveryOptionsForSelectedVariant,
    GetDeliveryOptionsForSelectedVariantInput,
    getPriceForSelectedVariant,
    getProductAvailabilitiesForSelectedVariant,
    getProductPageUrlSync,
    getSelectedVariant,
    IDimensionsApp,
    PriceForSelectedVariantInput,
    ProductAvailabilitiesForSelectedVariantInput,
    SelectedVariantInput,
    StringExtensions,
    validateCatalogId
} from '@msdyn365-commerce-modules/retail-actions';
import {
    format,
    getPayloadObject,
    getTelemetryAttributes,
    ITelemetryContent,
    onTelemetryClick
} from '@msdyn365-commerce-modules/utilities';
import React, { useState } from 'react';

import {
    IPriceComponentResources,
    PriceComponent,
    ISwatchItem,
    RatingComponent,
    ProductComponentSwatchComponent
    // AddToCartFunctionalComponent
} from '@msdyn365-commerce/components';
import { getCartState } from '@msdyn365-commerce/global-state';

export interface IProductComponentProps extends IComponentProps<{ product?: ProductSearchResult }> {
    className?: string;
    imageSettings?: IImageSettings;
    savingsText?: string;
    freePriceText?: string;
    originalPriceText?: string;
    currentPriceText?: string;
    ratingAriaLabel?: string;
    ratingCountAriaLabel?: string;
    allowBack?: boolean;
    telemetryContent?: ITelemetryContent;
    quickViewButton?: React.ReactNode;
    productComparisonButton?: React.ReactNode;
    inventoryLabel?: string;
    isPriceMinMaxEnabled?: boolean;
    priceResources?: IPriceComponentResources;
    dimensionAvailabilities?: IProductsDimensionsAvailabilities[];
    swatchItemAriaLabel?: string;
}

export interface IProductComponent extends IComponent<IProductComponentProps> {}

const PriceComponentActions = {};

/**
 * Renders product comparison button similar to the quick view button.
 * @param productComparisonButton - React element of the button.
 * @param product - Current product info.
 * @param catalogId - Current catalog.
 * @returns React element for the specific product.
 */
function renderProductComparisonButton(
    productComparisonButton: React.ReactNode,
    product: ProductSearchResult,
    catalogId: number
): JSX.Element | undefined {
    validateCatalogId(catalogId);
    return React.cloneElement(productComparisonButton as React.ReactElement, { product, catalogId });
}

const ProductCard: React.FC<IProductComponentProps> = ({
    data,
    context,
    imageSettings,
    savingsText,
    freePriceText,
    originalPriceText,
    currentPriceText,
    ratingAriaLabel,
    ratingCountAriaLabel,
    allowBack,
    typeName,
    id,
    telemetryContent,
    quickViewButton,
    productComparisonButton,
    inventoryLabel,
    isPriceMinMaxEnabled,
    priceResources,
    dimensionAvailabilities,
    swatchItemAriaLabel
}) => {
    const product = data.product;
    const dimensionContext = context as ICoreContext<IDimensionsApp>;
    const dimensionToPreSelectInProductCard = dimensionContext.app.config.dimensionToPreSelectInProductCard;

    /**
     * Updates the product url link to product details page.
     * @param  productDetailsPageUrl - Product page url.
     * @param  coreContext - Context of the module using the component.
     * @param  queryString - Querystring to be added to the URL.
     * @returns The update product page url.
     */
    function updateProductUrl(productDetailsPageUrl: string, coreContext: ICoreContext, queryString: string): string {
        const sourceUrl = new URL(productDetailsPageUrl, coreContext.request.apiSettings.baseUrl);
        if (sourceUrl.search) {
            sourceUrl.search += `&${queryString}`;
        } else {
            sourceUrl.search += queryString;
        }

        const updatedUrl = new URL(sourceUrl.href);
        return updatedUrl.pathname + sourceUrl.search;
    }

    /**
     * Gets the product page url from the default swatch selected.
     * @param  productData - Product card to be rendered.
     * @returns The default swatch selected if any.
     */
    function getDefaultSwatchSelected(productData?: ProductSearchResult): AttributeSwatch | null {
        if (!productData || !productData.AttributeValues) {
            return null;
        }

        const attributeSwatches = productData.AttributeValues.find(
            attributeValue => attributeValue.KeyName?.toLocaleLowerCase() === dimensionToPreSelectInProductCard
        )?.Swatches;

        if (!ArrayExtensions.hasElements(attributeSwatches)) {
            return null;
        }

        const defaultSwatch = attributeSwatches.find(item => item.IsDefault === true) ?? attributeSwatches[0];
        return defaultSwatch;
    }

    /**
     * Gets the product image from the default swatch selected.
     * @param  coreContext - Context of the module using the component.
     * @param  productData - Product card to be rendered.
     * @returns The product card image url.
     */
    function getProductImageUrlFromDefaultSwatch(coreContext: ICoreContext, productData?: ProductSearchResult): string | undefined {
        const defaultSwatch = getDefaultSwatchSelected(productData);
        const swatchProductImageUrls = defaultSwatch?.ProductImageUrls;
        if (!ArrayExtensions.hasElements(swatchProductImageUrls)) {
            return productData?.PrimaryImageUrl;
        }

        return generateImageUrl(swatchProductImageUrls[0], coreContext.request.apiSettings);
    }

    /**
     * Gets the product page url from the default swatch selected.
     * @param  coreContext - Context of the module using the component.
     * @param productUrl - Product page url for the product card.
     * @param  productData - Product card to be rendered.
     * @returns The product card image url.
     */
    function getProductPageUrlFromDefaultSwatch(
        coreContext: ICoreContext,
        productUrl: string,
        productData?: ProductSearchResult
    ): string | undefined {
        const defaultSwatch = getDefaultSwatchSelected(productData);
        if (!defaultSwatch?.SwatchValue) {
            return productUrl;
        }

        const queryStringEncoded = encodeURIComponent(defaultSwatch.SwatchValue);
        const queryString = `${dimensionToPreSelectInProductCard}=${queryStringEncoded}`;
        return updateProductUrl(productUrl, coreContext, queryString);
    }

    let productUrl = product ? getProductPageUrlSync(product.Name ?? '', product.RecordId, context.actionContext, undefined) : '';
    if (allowBack && productUrl) {
        productUrl = updateProductUrl(productUrl, context, 'back=true');
    }

    const productImageUrlFromSwatch = getProductImageUrlFromDefaultSwatch(context, product) ?? product?.PrimaryImageUrl;
    const productPageUrlFromSwatch = getProductPageUrlFromDefaultSwatch(context, productUrl, product) ?? productUrl;

    const [productPageUrl, setProductPageUrl] = useState<string>(productPageUrlFromSwatch);
    const [productImageUrl, setProductImageUrl] = useState<string | undefined>(productImageUrlFromSwatch);
    const [selectedSwatchItems] = useState(new Dictionary<DimensionTypes, ISwatchItem>());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access -- app context is generic
    const enableStockCheck = context.app.config.enableStockCheck;

    /**
     * Updates the product page and Image url based on swatch selected.
     * @param coreContext - Context of the caller.
     * @param swatchItem - Dimension swatch selected.
     */
    const updatePageAndImageUrl = React.useCallback(
        (coreContext: ICoreContext, swatchItem: ISwatchItem) => {
            const dimensionType = swatchItem.dimensionType;
            selectedSwatchItems.setValue(dimensionType, swatchItem);
            if (StringExtensions.isNullOrWhitespace(swatchItem.value)) {
                return;
            }
            const queryString = `${dimensionType}=${swatchItem.value}`;
            let productPageUrlWithSwatch = '';
            if (productPageUrl.includes(dimensionType)) {
                const newUrl = new URL(productPageUrl, coreContext.request.apiSettings.baseUrl);
                newUrl.searchParams.delete(dimensionType);
                productPageUrlWithSwatch = updateProductUrl(newUrl.toString(), context, queryString);
            } else {
                productPageUrlWithSwatch = updateProductUrl(productPageUrl, context, queryString);
            }
            setProductPageUrl(productPageUrlWithSwatch);
            if (dimensionType === dimensionToPreSelectInProductCard) {
                const swatchProductImageUrl = ArrayExtensions.hasElements(swatchItem.productImageUrls)
                    ? swatchItem.productImageUrls[0]
                    : undefined;
                const newImageUrl = generateImageUrl(swatchProductImageUrl, coreContext.request.apiSettings);
                setProductImageUrl(newImageUrl);
            }
        },
        [selectedSwatchItems, context, productPageUrl]
    );

    if (!product) {
        return null;
    }

    const swatchItems = ArrayExtensions.validValues(
        product.AttributeValues?.map(item => {
            const dimensionTypeValue = item.KeyName?.toLocaleLowerCase() ?? '';
            const shouldDisplayAsSwatch = checkIfShouldDisplayAsSwatch(
                dimensionTypeValue as DimensionTypes,
                context as ICoreContext<IDimensionsApp>,
                DimensionSwatchDisplayTypes.productCard
            );
            if (!shouldDisplayAsSwatch) {
                return null;
            }

            const dimensionType = dimensionTypeValue as DimensionTypes;
            const swatches =
                item.Swatches?.map<ISwatchItem>(swatchItem => {
                    return {
                        itemId: `${item.RecordId ?? ''}-${dimensionTypeValue}-${swatchItem.SwatchValue ?? ''}`,
                        value: swatchItem.SwatchValue ?? '',
                        dimensionType,
                        colorHexCode: swatchItem.SwatchColorHexCode,
                        imageUrl: swatchItem.SwatchImageUrl,
                        productImageUrls: swatchItem.ProductImageUrls,
                        isDefault: swatchItem.IsDefault,
                        swatchItemAriaLabel: swatchItemAriaLabel ? format(swatchItemAriaLabel, dimensionType) : '',
                        isDisabled:
                            enableStockCheck &&
                            dimensionAvailabilities?.find(
                                dimensionAvailability => dimensionAvailability.value === (swatchItem.SwatchValue ?? '')
                            )?.isDisabled
                    };
                }) ?? [];
            if (
                dimensionType === dimensionToPreSelectInProductCard &&
                ArrayExtensions.hasElements(swatches) &&
                !swatches.some(swatch => swatch.isDefault)
            ) {
                swatches[0].isDefault = true;
            }
            return { recordId: item.RecordId, swatches };
        })
    );

    // Construct telemetry attribute to render
    const payLoad = getPayloadObject('click', telemetryContent!, '', product.RecordId.toString());

    const attribute = getTelemetryAttributes(telemetryContent!, payLoad);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- -- Do not need type check for appsettings
    const isUnitOfMeasureEnabled = context.app.config && context.app.config.unitOfMeasureDisplayType === 'buyboxAndBrowse';

    /**
     * Gets the react node for product unit of measure display.
     * @param  unitOfMeasure - DefaultUnitOfMeasure property from product.
     * @returns The node representing markup for unit of measure component.
     */
    function renderProductUnitOfMeasure(unitOfMeasure?: string): JSX.Element | null {
        if (!unitOfMeasure) {
            return null;
        }
        return (
            <div className='msc-product__unit-of-measure'>
                <span>{unitOfMeasure}</span>
            </div>
        );
    }

    /**
     * Gets the react node for product availability.
     * @param inventoryAvailabilityLabel - The product information.
     * @returns The node representing markup for product availability.
     */
    function renderProductAvailability(inventoryAvailabilityLabel: string | undefined): JSX.Element | null {
        if (!inventoryAvailabilityLabel || inventoryAvailabilityLabel === '') {
            return null;
        }

        return (
            <div className='msc-product__availability'>
                <span>{inventoryAvailabilityLabel}</span>
            </div>
        );
    }

    /**
     * Gets the react node for product dimension as swatch.
     * @returns The node representing markup for unit of measure component.
     */
    function renderProductDimensions(): JSX.Element | null {
        if (!ArrayExtensions.hasElements(swatchItems)) {
            return null;
        }

        return (
            <div className='msc-product__dimensions'>
                {swatchItems.map(item => {
                    return (
                        <ProductComponentSwatchComponent
                            key={item.recordId}
                            context={context}
                            onSelectDimension={updatePageAndImageUrl}
                            swatches={item.swatches}
                        />
                    );
                })}
            </div>
        );
    }

    /**
     * Gets the react node for  product description.
     * @param  quickview - Quick view node.
     * @param  item - Product id to de displayed in quickview.
     * @returns The product quickview component.
     */
    function renderQuickView(quickview: React.ReactNode, item?: number): JSX.Element | undefined {
        if (quickview === null) {
            return undefined;
        }
        const selectedDimensions: ProductDimension[] = selectedSwatchItems.getValues().map<ProductDimension>(swatches => {
            return {
                DimensionTypeValue: convertDimensionTypeToProductDimensionType(swatches.dimensionType),
                DimensionValue: {
                    RecordId: 0,
                    Value: swatches.value
                }
            };
        });
        return React.cloneElement(quickview as React.ReactElement, { selectedProductId: item, selectedDimensions });
    }

    /**
     * Gets the aria label for rating.
     * @param  rating - Product rating.
     * @param  ratingAriaLabelText - Aria label format for rating.
     * @returns The product rating aria label string.
     */
    function getRatingAriaLabel(rating?: number, ratingAriaLabelText?: string): string {
        if (rating && ratingAriaLabelText) {
            const roundedRating = rating.toFixed(2);
            return format(ratingAriaLabelText || '', roundedRating, '5');
        }
        return '';
    }

    /**
     * Gets the aria label for review count.
     * @param  reviewCount - Product review count.
     * @param  ratingCountAriaLabelText - Aria label format for review.
     * @returns The product review count aria label string.
     */
    function getReviewAriaLabel(reviewCount?: number, ratingCountAriaLabelText?: string): string {
        if (reviewCount && ratingCountAriaLabelText) {
            return format(ratingCountAriaLabelText || '', reviewCount);
        }
        return '';
    }

    /**
     * Gets the aria label string for product that includes product name with its price and rating.
     * @param  name - Product name.
     * @param  price - Product price.
     * @param  rating - Product rating.
     * @param  ratingAriaLabelText - Rating aria label text.
     * @param  reviewCount - Product review count.
     * @param  ratingCountAriaLabelText - Number of ratings.
     * @returns The aria label string for the product card.
     */
    function renderLabel(
        name?: string,
        price?: string,
        rating?: number,
        ratingAriaLabelText?: string,
        reviewCount?: number,
        ratingCountAriaLabelText?: string,
        availability?: string
    ): string {
        const reviewCountArialableText = getReviewAriaLabel(reviewCount, ratingCountAriaLabelText ?? '');
        return `${name ?? ''} ${price ?? ''} ${getRatingAriaLabel(rating, ratingAriaLabelText)}${
            reviewCountArialableText ? ` ${reviewCountArialableText}` : ''
        } ${availability ?? ''}`;
    }

    /**
     * Gets the react component for product rating.
     * @param  productCardimageSettings - Module image settings for product card.
     * @param  gridSettings - Grid settings defined in theme.
     * @param  imageUrl - Image url.
     * @param fallbackImageUrl - Fallback url for imge.
     * @param  altText - Image Alt text.
     * @param  requestContext - Request context using the component.
     * @returns React component for product image.
     */
    function renderProductPlacementImage(
        productCardimageSettings?: IImageSettings,
        gridSettings?: IGridSettings,
        imageUrl?: string,
        fallbackImageUrl?: string,
        altText?: string,
        requestContext?: IRequestContext
    ): JSX.Element | null {
        if (!imageUrl || !gridSettings || !productCardimageSettings) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Site level config can be of any type.
        const emptyPlaceHolderImage = context.app.config.placeholderImageName as string;
        let fallbackImageSource = fallbackImageUrl;
        if (emptyPlaceHolderImage && fallbackImageUrl) {
            fallbackImageSource = `${fallbackImageUrl},${emptyPlaceHolderImage}`;
        }
        const image: IImageData = {
            src: imageUrl,
            altText: altText ? altText : '',
            fallBackSrc: fallbackImageSource
        };
        const imageProps: IImageProps = { gridSettings };

        imageProps.gridSettings = gridSettings;
        imageProps.imageSettings = productCardimageSettings;
        imageProps.imageSettings.cropFocalRegion = true;
        return <Image {...image} {...imageProps} loadFailureBehavior='empty' requestContext={requestContext} bypassHideOnFailure />;
    }

    /**
     * Gets the react component for product rating.
     * @param  coreContext - Context of the module using the component.
     * @param  moduleTypeName - Module type name.
     * @param  moduleId - Module id using the component.
     * @param  basePrice - Product base price.
     * @param  adjustedPrice - Product adjusted price.
     * @param  maxVariantPrice - Product variant max price.
     * @param  minVariantPrice - Product variant min price.
     * @param  savingsPriceResourceText - Product price saving text.
     * @param  freePriceResourceText - Product price free text.
     * @param  originalPriceResourceText - Product price original text.
     * @param  currentPriceResourceText - Product price current text.
     * @returns React component for Product price.
     */
    function renderPrice(
        coreContext: ICoreContext,
        moduleTypeName: string,
        moduleId: string,
        basePrice?: number,
        adjustedPrice?: number,
        maxVariantPrice?: number,
        minVariantPrice?: number,
        savingsPriceResourceText?: string,
        freePriceResourceText?: string,
        originalPriceResourceText?: string,
        currentPriceResourceText?: string
    ): JSX.Element | null {
        const price: ProductPrice = {
            BasePrice: basePrice,
            AdjustedPrice: adjustedPrice,
            CustomerContextualPrice: adjustedPrice,
            MaxVariantPrice: maxVariantPrice ? maxVariantPrice : adjustedPrice,
            MinVariantPrice: minVariantPrice ? minVariantPrice : adjustedPrice
        };

        return (
            <PriceComponent
                context={coreContext}
                id={moduleId}
                typeName={moduleTypeName}
                data={{ price }}
                savingsText={savingsPriceResourceText}
                freePriceText={freePriceResourceText}
                originalPriceText={originalPriceResourceText}
                currentPriceText={currentPriceResourceText}
                isPriceMinMaxEnabled={isPriceMinMaxEnabled}
                priceResources={priceResources}
            />
        );
    }

    /**
     * Gets the react node for product description.
     * @param  description - Product description.
     * @returns The product description component.
     */
    function renderDescription(description?: string): JSX.Element | null {
        return <p className='msc-product__text'>{description}</p>;
    }

    /**
     * Gets the react component for product rating.
     * @param  coreContext - Context of the module using the component.
     * @param  moduleTypeName - Module type name.
     * @param  moduleId - Module id using the component.
     * @param  avgRating - Average rating.
     * @param  totalRatings - Total rating.
     * @param  ariaLabel - Aria label for rating.
     * @returns React component for Product rating.
     */
    function renderRating(
        coreContext: ICoreContext,
        moduleTypeName: string,
        moduleId: string,
        avgRating?: number,
        totalRatings?: number,
        ariaLabel?: string
    ): JSX.Element | null {
        if (!avgRating) {
            return null;
        }

        const numberRatings = totalRatings?.toString() || undefined;
        const ratingAriaLabelText = getRatingAriaLabel(avgRating, ariaLabel);
        const ratingCountAriaLabelText = getReviewAriaLabel(Number(numberRatings), ratingCountAriaLabel);

        return (
            <RatingComponent
                context={coreContext}
                id={moduleId}
                typeName={moduleTypeName}
                avgRating={avgRating}
                ratingCount={numberRatings}
                readOnly
                ariaLabel={ratingAriaLabelText}
                ratingCountAriaLabel={ratingCountAriaLabelText}
                data={{}}
            />
        );
    }

    const onAddClick = async () => {
        if (product.IsMasterProduct) {
            window.location.href = productPageUrl;
        } else {
            const productVariant: SimpleProduct | null = await getSelectedVariant(
                new SelectedVariantInput(
                    product.MasterProductId ? product.MasterProductId : product.RecordId,
                    context.request.apiSettings.channelId,
                    undefined,
                    undefined,
                    context.request
                ),
                context.actionContext
            );
            if (productVariant) {
                await getProductAvailabilitiesForSelectedVariant(
                    new ProductAvailabilitiesForSelectedVariantInput(productVariant.RecordId, context.request.apiSettings.channelId),
                    context.actionContext
                );

                await getPriceForSelectedVariant(
                    new PriceForSelectedVariantInput(productVariant.RecordId, context.request.apiSettings.channelId),
                    context.actionContext
                );

                await getDeliveryOptionsForSelectedVariant(
                    new GetDeliveryOptionsForSelectedVariantInput(
                        productVariant.RecordId,
                        context.request.apiSettings.channelId,
                        undefined,
                        undefined,
                        false
                    ),
                    context.actionContext
                );

                const cartState = await getCartState(context.actionContext);
                await cartState.addProductToCart({
                    product: productVariant,
                    count: 1
                });
            }
        }
    };

    return (
        <>
            <a
                href={productPageUrl}
                onClick={onTelemetryClick(telemetryContent!, payLoad, product.Name!)}
                aria-label={renderLabel(
                    product.Name,
                    context.cultureFormatter.formatCurrency(product.Price),
                    product.AverageRating,
                    ratingAriaLabel,
                    product.TotalRatings,
                    ratingCountAriaLabel,
                    inventoryLabel
                )}
                className='msc-product'
                {...attribute}
            >
                <div className='msc-product__image'>
                    {renderProductPlacementImage(
                        imageSettings,
                        context.request.gridSettings,
                        productImageUrl,
                        product.PrimaryImageUrl,
                        product.Name,
                        context.actionContext.requestContext
                    )}
                </div>
            </a>
            {renderProductDimensions()}
            <div className='msc-product__details'>
                <div>
                    <h4 className='msc-product__title'>{product.Name}</h4>
                    {renderPrice(
                        context,
                        typeName,
                        id,
                        product.BasePrice,
                        product.Price,
                        product.MaxVariantPrice,
                        product.MinVariantPrice,
                        savingsText,
                        freePriceText,
                        originalPriceText,
                        currentPriceText
                    )}
                    {isUnitOfMeasureEnabled && renderProductUnitOfMeasure(product.DefaultUnitOfMeasure)}
                    {renderDescription(product.Description)}
                    {!context.app.config.hideRating &&
                        renderRating(context, typeName, id, product.AverageRating, product.TotalRatings, ratingAriaLabel)}
                    {renderProductAvailability(inventoryLabel)}
                </div>
                <button id='msc-product-card-add-product' onClick={onAddClick}>
                    Add
                </button>
            </div>
            {quickViewButton && renderQuickView(quickViewButton, product.RecordId)}
            {productComparisonButton && renderProductComparisonButton(productComparisonButton, product, getCatalogId(context.request))}
        </>
    );
};

export const ProductComponent: React.FunctionComponent<IProductComponentProps> = msdyn365Commerce.createComponent<IProductComponent>(
    'Product',
    { component: ProductCard, ...PriceComponentActions }
);
