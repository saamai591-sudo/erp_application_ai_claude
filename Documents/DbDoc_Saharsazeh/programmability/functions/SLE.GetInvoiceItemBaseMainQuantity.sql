    
	

CREATE FUNCTION [SLE].[GetInvoiceItemBaseMainQuantity]
    (
        @InvoiceItemId INT
    )
RETURNS DECIMAL(30, 4)
AS
    BEGIN
        -- Declare the return variable here
        DECLARE @MainQuantity DECIMAL(30, 4);

        SELECT @MainQuantity = ( CASE WHEN ji2.JustificationItemID IS NOT NULL THEN
                                      ji2.MainQuantity
                                  WHEN ji.JustificationItemID IS NOT NULL THEN
                                      ji2.MainQuantity
                                  WHEN ji3.JustificationItemID IS NOT NULL THEN
                                      ji3.MainQuantity
                                  WHEN ji4.JustificationItemID IS NOT NULL THEN
                                      ji4.MainQuantity
                                  WHEN qi.QuotationItemID IS NOT NULL THEN
                                      qi.MainQuantity
                                  WHEN qi2.QuotationItemID IS NOT NULL THEN
                                      qi2.MainQuantity
                                  WHEN qi3.QuotationItemID IS NOT NULL THEN
                                      qi3.MainQuantity
                                  WHEN sci.SaleContractItemID IS NOT NULL THEN
                                      sci.MainQuantity
                                  WHEN sci2.SaleContractItemID IS NOT NULL THEN
                                      sci2.MainQuantity
                                  WHEN sci3.SaleContractItemID IS NOT NULL THEN
                                      sci3.MainQuantity
                                  WHEN sci4.SaleContractItemID IS NOT NULL THEN
                                      sci4.MainQuantity
                                  ELSE 0
                             END )
        FROM   SLE.InvoiceItem AS ii
               LEFT JOIN SLE.JustificationItem AS ji2 ON ji2.JustificationItemID = ii.JustificationItemID
               LEFT JOIN SLE.QuotationItem AS qi ON qi.QuotationItemID = ii.QuotationItemID
               LEFT JOIN SLE.SaleContractItem AS sci4 ON sci4.SaleContractItemID = ii.SaleContractItemID
               -------------------------
               LEFT JOIN STC.OutgoingItem AS oi ON oi.OutgoingItemID = ii.OutgoingItemID
               LEFT JOIN SLE.JustificationItem AS ji ON ji.JustificationItemID = oi.JustificationItemID
               -------------------------
               LEFT JOIN SLE.SaleContractItem AS sci3 ON sci3.SaleContractItemID = oi.SaleContractItemID
               -------------------------
               LEFT JOIN SLE.RemittanceItem AS ri2 ON ri2.RemittanceItemID = oi.RemittanceItemID
               LEFT JOIN SLE.JustificationItem AS ji4 ON ji4.JustificationItemID = ri2.JustificationItemID
               -------------------------
               LEFT JOIN SLE.SaleContractItem AS sci ON ri2.SaleContractItemID = sci.SaleContractItemID
               -------------------------
               LEFT JOIN SLE.QuotationItem AS qi3 ON ri2.QuotationItemID = qi3.QuotationItemID
               -------------------------
               LEFT JOIN SLE.RemittanceItem AS ri ON ri.RemittanceItemID = ii.RemittanceItemID
               LEFT JOIN SLE.JustificationItem AS ji3 ON ji3.JustificationItemID = ri.JustificationItemID
               -------------------------
               LEFT JOIN SLE.SaleContractItem AS sci2 ON ri.SaleContractItemID = sci2.SaleContractItemID
               -------------------------
               LEFT JOIN SLE.RemittanceItem AS ri3 ON ri3.RemittanceItemID = ii.RemittanceItemID
               LEFT JOIN SLE.QuotationItem AS qi2 ON qi2.QuotationItemID = ri3.QuotationItemID
        WHERE  ii.InvoiceItemID = @InvoiceItemId;

        IF @MainQuantity IS NULL
            SET @MainQuantity = 0;

        RETURN @MainQuantity;


    END;
