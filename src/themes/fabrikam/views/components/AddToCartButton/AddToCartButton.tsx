import React from "react";
import { ProductSearchResult, SimpleProduct } from "@msdyn365-commerce/retail-proxy";
import { getSelectedVariant, SelectedVariantInput } from "@msdyn365-commerce-modules/retail-actions";
import { getCartState } from "@msdyn365-commerce/global-state";
import { ICoreContext } from "@msdyn365-commerce/core";

import { BasketIcon } from "./BasketIcon";

type Props = {
  context: ICoreContext<{[p: string]: any}>;
  product: ProductSearchResult;
  productPageUrl: string;
}

export const AddToCartButton = ({ context, product, productPageUrl, ...props }: Props) => {
  const onClick = async () => {
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
        const cartState = await getCartState(context.actionContext);

        await cartState.addProductToCart({
          product: productVariant,
          count: 1
        });
      }
    }
  };

  return (
    <button {...props} className="msc-product-card-add-product" id='msc-product-card-add-product' onClick={onClick}>
      <BasketIcon />
    </button>
  )
}
