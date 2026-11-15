------------------------------------- START #6917 #7234
create    PROCEDURE [AST].[GetUtilizationCosts]
(
    @ID int
)
--WITH ENCRYPTION 
AS
    BEGIN

		declare @Culture NVARCHAR(5),
			@CultureNo tinyint
	    
		SET @Culture = cfg.GetuserCulture()	

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture

		select u.UtilizationCostID,
		       u.CreationID, 
			   u.BaseType,
			   u.PurchaseInvoiceItemID,
			   pr.Non + u.Price  PurchaseInvoiceNonReceiptCost,
			   u.OutgoingItemID,
			   CASE
                   WHEN u.PurchaseInvoiceItemID IS NOT NULL THEN u.PurchaseInvoiceItemID
				   WHEN u.OutgoingItemID IS NOT NULL THEN u.OutgoingItemID
                   ELSE NULL
               END AS BaseDocumentID,
			   CASE
                   WHEN u.PurchaseInvoiceItemID IS NOT NULL THEN p.Number
                   WHEN u.OutgoingItemID IS NOT NULL THEN o.Number 
                   ELSE NULL 
               END AS BaseDocumentNumber,
			   u.StuffID,
			   s.StuffCode,
			   case @CultureNo
					when 1 then s.Title
					when 2 then s.Title2
			   end as StuffTitle,

			   u.MainQuantity,
			   u.SubQuantity,
			   u.Price,		   
			   u.Version,
			   u.Creator,
			   u.CreationDate
			from ast.UtilizationCost u
				 left join VND.PurchaseInvoiceItem i on u.PurchaseInvoiceItemID = i.PurchaseInvoiceItemID
				 left join VND.PurchaseInvoice p on i.PurchaseInvoiceID = p.PurchaseInvoiceID
				 left join VND.PurchaseInvoice_PriceRemains pr on i.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
 				 left join STC.OutgoingItem oi on u.OutgoingItemID = oi.OutgoingItemID
				 left join STC.Outgoing o on oi.OutgoingID = o.OutgoingID
				 join STF.[VWStuff] s on u.StuffID = s.StuffID
			where u.CreationID = @ID
	     
    END
