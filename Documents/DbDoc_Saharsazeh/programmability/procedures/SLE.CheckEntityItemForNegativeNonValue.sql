
CREATE   PROCEDURE [SLE].CheckEntityItemForNegativeNonValue
(
	@entity NVARCHAR(MAX),
	@entityId INT
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @baseType INT,
			@Message NVARCHAR(MAX),
			@RowIndexs NVARCHAR(MAX),
			@IncreaseQuantityAccessKey NVARCHAR(255),
			@userId INT;

	DECLARE @table TABLE
	(
		RowIndex INT NOT NULL
	);

	-- Keep fee violations separate from quantity violations so each gets its own message.
	DECLARE @FeeViolationRows TABLE
	(
		RowIndex INT NOT NULL
	);

	SET @userId = CFG.GetuserID();

	IF @entity = 'StockReceiptChargingService'
	BEGIN

		DECLARE @stockReceiptId INT;

		SELECT @stockReceiptId = sri.StockReceiptID
		FROM STC.StockReceiptItem AS sri
		WHERE sri.StockReceiptItemID = @entityId;

		INSERT @table
		SELECT srcs.RowIndex
		FROM STC.StockReceiptChargingService AS srcs
			JOIN STC.StockReceiptItem AS sri
				ON sri.StockReceiptItemID = srcs.StockReceiptItemID
			JOIN SLE.Outgoing_Remains AS ore
				ON ore.OutgoingItemID = srcs.OutgoingItemID
		WHERE sri.StockReceiptID = @stockReceiptId
			  AND
			  (
				  ore.Non < 0
				  OR ore.NonSub < 0
			  );

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;
	END;

	IF @entity = 'SaleContract'
	BEGIN

		SELECT @baseType = BaseDocument
		FROM SLE.Invoice
		WHERE InvoiceID = @entityId;

		IF @baseType = 4 --Quotation 
		BEGIN

			INSERT @table
			SELECT ii.RowIndex
			FROM SLE.SaleContractItem AS ii
				JOIN SLE.SaleContract_Remains AS rr
					ON rr.SaleContractItemID = ii.SaleContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.SubNon < 0
				  )
				  AND ii.SaleContractItemID = @entityId;

		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;

	END;

	IF @entity = 'Invoice'
	BEGIN

		SELECT @baseType = BaseDocument
		FROM SLE.Invoice
		WHERE InvoiceID = @entityId;

		IF @baseType = 3 -- justification 
		BEGIN

			INSERT @table
			SELECT ii.RowIndex
			FROM SLE.InvoiceItem ii
				JOIN SLE.Justification_Remains rr
					ON rr.JustificationItemID = ii.JustificationItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND ii.InvoiceID = @entityId;
		END;

		IF @baseType = 4 --Quotation 
		BEGIN

			INSERT @table
			SELECT ii.RowIndex
			FROM SLE.InvoiceItem ii
				JOIN SLE.Quotation_Remains rr
					ON rr.QuotationItemID = ii.QuotationItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND ii.InvoiceID = @entityId;

		END;

		IF @baseType = 5 --Remittance 
		BEGIN

			INSERT @table
			SELECT ii.RowIndex
			FROM SLE.InvoiceItem ii
				JOIN SLE.Remittance_Remains rr
					ON rr.RemittanceItemID = ii.RemittanceItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND ii.InvoiceID = @entityId;

		END;

		IF @baseType = 9 --Outgoing 
		BEGIN
			INSERT @table
			SELECT ii.RowIndex
			FROM SLE.InvoiceItem ii
				JOIN SLE.Outgoing_Remains rr
					ON rr.OutgoingItemID = ii.OutgoingItemId
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND ii.InvoiceID = @entityId;
		END;

		IF @baseType = 14 --SaleContract 
		BEGIN
			INSERT @table
			SELECT ii.RowIndex
			FROM SLE.InvoiceItem AS ii
				JOIN SLE.SaleContract_Remains AS rr
					ON rr.SaleContractItemID = ii.SaleContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.SubNon < 0
				  )
				  AND ii.InvoiceID = @entityId;
		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;


	END;

	IF @entity = 'Quotation'
	BEGIN

		SELECT @baseType = BaseDocument
		FROM SLE.Quotation
		WHERE QuotationID = @entityId;

		IF @baseType = 2 --order 
		BEGIN

			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.QuotationItem qi
				JOIN SLE.Order_Remains rr
					ON rr.OrderItemID = qi.OrderItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.QuotationID = @entityId;
		END;

		IF @baseType = 3 -- justification 
		BEGIN

			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.QuotationItem qi
				JOIN SLE.Justification_Remains rr
					ON rr.JustificationItemID = qi.JustificationItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.QuotationID = @entityId;
		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;

	END;

	IF @entity = 'Remittance'
	BEGIN

		SELECT @baseType = BaseDocument
		FROM SLE.Remittance
		WHERE RemittanceID = @entityId;

		IF @baseType = 4 -- Quotation
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.RemittanceItem qi
				JOIN SLE.Quotation_Remains rr
					ON rr.QuotationItemID = qi.QuotationItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.RemittanceID = @entityId;
		END;

		IF @baseType = 3 --Justification
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.RemittanceItem qi
				JOIN SLE.Justification_Remains rr
					ON rr.JustificationItemID = qi.JustificationItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.RemittanceID = @entityId;
		END;

		IF @baseType = 6 -- Invoice
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.RemittanceItem qi
				JOIN SLE.Invoice_Remains rr
					ON rr.InvoiceItemID = qi.InvoiceItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.RemittanceID = @entityId;
		END;

		IF @baseType = 14 -- SaleContract
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.RemittanceItem qi
				JOIN SLE.SaleContract_Remains rr
					ON rr.SaleContractItemID = qi.SaleContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.SubNon < 0
				  )
				  AND qi.RemittanceID = @entityId;
		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;

	END;

	IF @entity = 'Justification'
	BEGIN

		SELECT @baseType = BaseDocument
		FROM SLE.Justification
		WHERE JustificationID = @entityId;

		IF @baseType = 2 -- order
		BEGIN

			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.JustificationItem qi
				JOIN SLE.Order_Remains rr
					ON rr.OrderItemID = qi.OrderItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.JustificationID = @entityId;
		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;

	END;

	IF @entity = 'Outgoing'
	BEGIN

		SELECT @baseType = sdtb.BaseEntity
		FROM STC.Outgoing o
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		WHERE OutgoingID = @entityId;

		IF @baseType = 3 -- Justification
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN SLE.Justification_Remains rr
					ON rr.JustificationItemID = qi.JustificationItemID
			WHERE (
					  (rr.Non < 0
					  OR rr.NonSub < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF @baseType = 4 -- Quotation 
		BEGIN

			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN SLE.Quotation_Remains rr
					ON rr.QuotationItemID = qi.QuotationItemID
			WHERE (
					  (rr.Non < 0
					  OR rr.NonSub < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF @baseType = 5 -- Remittance 
		BEGIN

			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN SLE.Remittance_Remains rr
					ON rr.RemittanceItemID = qi.RemittanceItemID
			WHERE (
					  (rr.Non < 0
					  OR rr.NonSub < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF @baseType = 6 -- Invoice 
		BEGIN

			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN SLE.Invoice_Remains rr
					ON rr.InvoiceItemID = qi.InvoiceItemID
			WHERE (
					  (rr.Non < 0
					  OR rr.NonSub < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF @baseType = 7 -- TemporaryOutgoing
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN STC.TemporaryOutgoing_Remain rr
					ON rr.TemporaryOutgoingItemID = qi.TemporaryOutgoingItemID
			WHERE (
					  (rr.Non < 0
					  OR rr.NonSub < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF @baseType = 2 -- StuffRequest
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN REQ.StuffRequest_Remains rr
					ON rr.StuffRequestItemID = qi.StuffRequestItemID
			WHERE (
					  (rr.NonOutgoing < 0
					  OR rr.NonSubOutgoing < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF @baseType = 9 -- SaleContract
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.OutgoingItem qi
				JOIN SLE.SaleContract_Remains AS rr
					ON rr.SaleContractItemID = qi.SaleContractItemID
			WHERE (
					  (rr.Non < 0
					  OR rr.SubNon < 0)
					  AND qi.IsQuantityIncreasable = 0
				  )
				  AND qi.OutgoingID = @entityId;
		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;

	END;

	IF @entity = 'ReturnedTemporaryOutgoing'
	BEGIN
		INSERT @table
		SELECT ROW_NUMBER() OVER (ORDER BY qi.ReturnedTemporaryOutgoingItemID) --s.Code
		FROM STC.ReturnedTemporaryOutgoingItem qi
			JOIN STC.TemporaryOutgoing_Remain rr
				ON rr.TemporaryOutgoingItemID = qi.TemporaryOutgoingItemID
			JOIN STC.TemporaryOutgoingItem toi
				ON toi.TemporaryOutgoingItemID = qi.TemporaryOutgoingItemID
			JOIN STF.[Stuff] s
				ON s.StuffID = toi.StuffID
		WHERE (
				  rr.Non < 0
				  OR rr.NonSub < 0
			  )
			  AND qi.ReturnedTemporaryOutgoingID = @entityId;
	END;

	IF @entity = 'ReturnedSaleJustification'
	BEGIN
		SELECT @baseType = BaseDocument
		FROM SLE.ReturnedSaleJustification
		WHERE ReturnedSaleJustificationID = @entityId;

		IF @baseType = 6 -- Invoice
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM SLE.ReturnedSaleJustificationItem qi
				JOIN SLE.Invoice_Return_Remains rr
					ON rr.InvoiceItemID = qi.InvoiceItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ReturnedSaleJustificationID = @entityId;

			--the fee check runs only if the quantity check found no violations
			IF NOT EXISTS (SELECT 1 FROM @table)
			BEGIN
				INSERT @table
				SELECT rsji.RowIndex
				FROM SLE.ReturnedSaleJustificationItem rsji
					JOIN SLE.InvoiceItem ii
						ON ii.InvoiceItemID = rsji.InvoiceItemID
				WHERE rsji.Fee > ii.Fee
					  AND rsji.ReturnedSaleJustificationID = @entityId;

				IF EXISTS (SELECT 1 FROM @table)
				BEGIN

					SELECT @Message = lsv.[Value]
					FROM CFG.LocalizationSQLMessage ls
						JOIN CFG.LocalizationSQLMessageValue lsv
							ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'ItemFeeBiggerThanBase'
						  AND lsv.Culture = CFG.GetuserCulture();

					SET @RowIndexs = STUFF(
									 (
										 SELECT DISTINCT
												' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
										 FROM @table tt
										 FOR XML PATH('')
									 ),
									 1,
									 3,
									 ''
										  );

					RAISERROR(@Message, 16, 12, @RowIndexs);
					RETURN;
				END;

				INSERT @table
				SELECT rsji.RowIndex
				FROM SLE.ReturnedSaleJustificationItem rsji
					LEFT JOIN
					(
						SELECT ii.InvoiceItemID,
							   (ii.Discount - ISNULL(u.Discount, 0)) AS NonDiscount
						FROM SLE.InvoiceItem AS ii
							LEFT JOIN
							(
								SELECT r.InvoiceItemID,
									   SUM(r.Discount) Discount
								FROM SLE.ReturnedSaleJustificationItem AS r
								GROUP BY r.InvoiceItemID
							) u
								ON u.InvoiceItemID = ii.InvoiceItemID
					) AS A
						ON A.InvoiceItemID = rsji.InvoiceItemID
				WHERE A.NonDiscount < 0
					  AND rsji.ReturnedSaleJustificationID = @entityId;

				IF EXISTS (SELECT 1 FROM @table)
				BEGIN
					SELECT @Message = lsv.[Value]
					FROM CFG.LocalizationSQLMessage ls
						JOIN CFG.LocalizationSQLMessageValue lsv
							ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'ItemDiscountBiggerThanBase'
						  AND lsv.Culture = CFG.GetuserCulture();

					SET @RowIndexs = STUFF(
									 (
										 SELECT DISTINCT
												' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
										 FROM @table tt
										 FOR XML PATH('')
									 ),
									 1,
									 3,
									 ''
										  );

					RAISERROR(@Message, 16, 12, @RowIndexs);
					RETURN;
				END;

			END;
		END;
	END;

	IF @entity = 'ReturnedOutgoing'
	BEGIN
		SELECT @baseType = sdtb.BaseEntity
		FROM STC.ReturnedOutgoing ro
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		WHERE ro.ReturnedOutgoingID = @entityId;

		IF @baseType = 13 --ReturnedSaleJustification
		Begin
			INSERT @table
			SELECT roi.RowIndex
			FROM STC.ReturnedOutgoingItem roi
				JOIN SLE.ReturnedSaleJustification_Remain rsji
					ON rsji.ReturnedSaleJustificationItemID = roi.ReturnedSaleJustificationItemID
			WHERE (
					  rsji.Non < 0
					  OR rsji.NonSub < 0
				  )
				  AND roi.ReturnedOutgoingID = @entityId;
		END
		IF @baseType = 12 --Outgoing
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.ReturnedOutgoingItem qi
				JOIN SLE.Outgoing_Return_Remain rr
					ON rr.OutgoingItemID = qi.OutgoingItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ReturnedOutgoingItemID = @entityId;
		END
	END;

	IF @entity = 'ReturnRequest'
	BEGIN
		SELECT @baseType = DocumentType
		FROM REQ.ReturnRequest
		WHERE ReturnRequestID = @entityId;

		IF @baseType = 3 -- StockReceipt
		BEGIN
			INSERT @table
			SELECT qi.ReturnRequestItemIndex
			FROM REQ.ReturnRequestItem qi
				JOIN STC.StockReceipt_Remains rr
					ON rr.StockReceiptItemID = qi.StockReceiptItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ReturnRequestID = @entityId;
		END;

		ELSE IF @baseType = 4 -- TempStockReceipt
		BEGIN
			INSERT @table
			SELECT qi.ReturnRequestItemIndex
			FROM REQ.ReturnRequestItem qi
				JOIN STC.fn_TemporaryStockReceipt_Remains(null, null, null, 1) rr
					ON rr.TemporaryStockReceiptItemID = qi.TemporaryStockReceiptItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ReturnRequestID = @entityId;
		END;
	END;

	IF @entity = 'PurchaseRequest'
	BEGIN
		SELECT @baseType = BaseDocument
		FROM REQ.PurchaseRequest
		WHERE PurchaseRequestID = @entityId;

		IF @baseType = 2 -- StuffRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseRequestStuffRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.PurchaseRequestItemIndex
			FROM REQ.PurchaseRequestItem qi
				JOIN REQ.StuffRequest_Remains rr
					ON rr.StuffRequestItemID = qi.StuffRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseRequestID = @entityId;
		END;

		IF @baseType = 5 -- Order
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseRequestOrderBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.PurchaseRequestItemIndex
			FROM REQ.PurchaseRequestItem qi
				JOIN CTM.Order_Non_Request AS onr
					ON onr.OrderItemID = qi.OrderItemID
			WHERE (
					  onr.Non < 0
					  OR onr.NonSub < 0
				  )
				  AND qi.PurchaseRequestID = @entityId;
		END;

		IF @baseType = 6 -- Justification
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseRequestJustificationBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.PurchaseRequestItemIndex
			FROM REQ.PurchaseRequestItem qi
				JOIN SLE.Justification_Non_Request AS onr
					ON onr.JustificationItemID = qi.JustificationItemID
			WHERE (
					  onr.Non < 0
					  OR onr.NonSub < 0
				  )
				  AND qi.PurchaseRequestID = @entityId;
		END;

		IF @baseType = 7 -- Quotation
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseRequestQuotationBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.PurchaseRequestItemIndex
			FROM REQ.PurchaseRequestItem qi
				JOIN SLE.Quotation_Non_Request AS onr
					ON onr.QuotationItemID = qi.QuotationItemID
			WHERE (
					  onr.Non < 0
					  OR onr.NonSub < 0
				  )
				  AND qi.PurchaseRequestID = @entityId;
		END;

		IF @baseType = 8 -- SaleConract
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseRequestSaleContractBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.PurchaseRequestItemIndex
			FROM REQ.PurchaseRequestItem qi
				JOIN SLE.SaleContract_Non_Request AS onr
					ON onr.SaleContractItemID = qi.SaleContractItemID
			WHERE (
					  onr.Non < 0
					  OR onr.NonSub < 0
				  )
				  AND qi.PurchaseRequestID = @entityId;
		END;
	END;

	IF @entity = 'StuffRequest'
	BEGIN
		SELECT @baseType = BaseDocument
		FROM REQ.StuffRequest AS sri
		WHERE sri.StuffRequestID = @entityId;
		IF (@baseType = 2)
		BEGIN
			INSERT @table
			SELECT sri.StuffRequestItemIndex
			FROM REQ.StuffRequestItem AS sri
				LEFT JOIN
				(
					SELECT rp2.RequiredMaterialID,
						   rp2.RequiredQuantity - ISNULL(used1.MainQuantity, 0) AS Non
					FROM PRM.RequiredMaterial AS rp2
						LEFT JOIN
						(
							SELECT sri.RequiredMaterialID,
								   SUM(sri.MainQuantity) AS MainQuantity
							FROM REQ.StuffRequestItem AS sri
							GROUP BY sri.RequiredMaterialID
						) used1
							ON used1.RequiredMaterialID = rp2.RequiredMaterialID
				) AS non
					ON non.RequiredMaterialID = sri.RequiredMaterialID
			WHERE non.Non < 0
				  AND sri.StuffRequestID = @entityId;

		END;
		ELSE IF @baseType = 3
		BEGIN
			INSERT @table
			SELECT sri.StuffRequestItemIndex
			FROM REQ.StuffRequestItem AS sri
				LEFT JOIN
				(
					SELECT rp2.RequiredProductID,
						   rp2.RequiredQuantity - ISNULL(used1.MainQuantity, 0) AS Non
					FROM PRM.RequiredProduct AS rp2
						LEFT JOIN
						(
							SELECT sri.RequiredProductID,
								   SUM(sri.MainQuantity) AS MainQuantity
							FROM REQ.StuffRequestItem AS sri
							GROUP BY sri.RequiredProductID
						) used1
							ON used1.RequiredProductID = rp2.RequiredProductID
				) AS non
					ON non.RequiredProductID = sri.RequiredProductID
			WHERE non.Non < 0
				  AND sri.StuffRequestID = @entityId;
		END;

	END;

	IF @entity = 'Proposal'
	BEGIN
		SELECT @baseType = BaseDocument
		FROM VND.Proposal
		WHERE ProposalID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'ProposalPurchaseRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.ProposalItem qi
				JOIN REQ.PurchaseRequest_Remains rr
					ON rr.PurchaseRequestItemID = qi.PurchaseRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ProposalID = @entityId;
		END;

	END;

	IF @entity = 'TenderRequest'
		BEGIN
				SELECT @baseType = BaseDocument
				FROM REQ.TenderRequest
				WHERE TenderRequestID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			INSERT @table
			SELECT tri.RowIndex
			FROM REQ.TenderRequestItem tri
				JOIN REQ.PurchaseRequest_Remains prr
					ON prr.PurchaseRequestItemID = tri.PurchaseRequestItemID
			WHERE (
					  prr.Non < 0
					  OR prr.NonSub < 0
				  )
				  AND tri.TenderRequestID = @entityId;
		END;

	END;

	IF @entity = 'TemporaryStockReceipt'
	BEGIN
		SELECT @baseType = sdtb.BaseEntity
		FROM STC.TemporaryStockReceipt tsr
		JOIN STC.StockDocumentTypeBaseEntity sdtb
			ON tsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		WHERE tsr.TemporaryStockReceiptID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'TemporaryStockReceiptPurchaseRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.TemporaryStockReceiptItem qi
				JOIN REQ.PurchaseRequest_Remains rr
					ON rr.PurchaseRequestItemID = qi.PurchaseRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.TemporaryStockReceiptID = @entityId;
		END;

		ELSE IF @baseType = 3 -- Proposal
		BEGIN
			SET @IncreaseQuantityAccessKey = N'TemporaryStockReceiptProposalBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.TemporaryStockReceiptItem qi
				JOIN VND.Proposal_Remains rr
					ON rr.ProposalItemID = qi.ProposalItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.TemporaryStockReceiptID = @entityId;
		END;
		ELSE IF @baseType = 8 -- PurchaseContract
		BEGIN
			SET @IncreaseQuantityAccessKey = N'TemporaryStockReceiptPurchaseContractBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.TemporaryStockReceiptItem qi
				JOIN VND.PurchaseContract_Remains rr
					ON rr.PurchaseContractItemID = qi.PurchaseContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.TemporaryStockReceiptID = @entityId;
		END;
	END;

	IF @entity = 'ReturnedTemporaryStockReceipt'
	BEGIN
		SELECT @baseType = sdtb.BaseEntity
		FROM STC.ReturnedTemporaryStockReceipt rtsr
		JOIN STC.StockDocumentTypeBaseEntity sdtb
			ON rtsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		WHERE rtsr.ReturnedTemporaryStockReceiptID = @entityId;

		IF @baseType = 4 -- TemporaryReceipt
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.ReturnedTemporaryStockReceiptItem qi
				JOIN STC.fn_TemporaryStockReceipt_Remains(null, null, null, 1) rr
					ON rr.TemporaryStockReceiptItemID = qi.TemporaryStockReceiptItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ReturnedTemporaryStockReceiptID = @entityId;
		END;

		ELSE IF @baseType = 5 -- ReturnRequest
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.ReturnedTemporaryStockReceiptItem qi
				JOIN REQ.ReturnRequest_Remains rr
					ON rr.ReturnRequestItemID = qi.ReturnRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.ReturnedTemporaryStockReceiptID = @entityId;
		END;

	END;

	IF @entity = 'PurchaseInvoice'
	BEGIN
		SELECT @baseType = BaseType
		FROM VND.PurchaseInvoice
		WHERE PurchaseInvoiceID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseInvoicePurchaseRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseInvoiceItem qi
				JOIN REQ.PurchaseRequest_Remains rr
					ON rr.PurchaseRequestItemID = qi.PurchaseRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseInvoiceID = @entityId;
		END;

		IF @baseType = 3 -- contract
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseInvoiceContractBaseIncreaseQuantity';

			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseInvoiceItem qi
				JOIN
				(
					SELECT cs.ContractSubjectID,
						   cs.Quantity,
						   cs.Quantity - ISNULL(used1.DoMainQuantity, 0) AS Non
					FROM CNT.ContractSubject AS cs
						LEFT JOIN
						(
							SELECT pii.ContractSubjectID,
								   SUM(pii.MainQuantity) DoMainQuantity,
								   SUM(pii.SubQuantity) AS DosubQuantity
							FROM VND.PurchaseInvoiceItem AS pii
							GROUP BY pii.ContractSubjectID
						) AS used1
							ON used1.ContractSubjectID = cs.ContractSubjectID
				) rr
					ON rr.ContractSubjectID = qi.ContractSubjectID
			WHERE (rr.Non < 0)
				  AND qi.PurchaseInvoiceID = @entityId;

		END;

		IF @baseType = 5 -- Proposal
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseInvoiceProposalBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseInvoiceItem qi
				JOIN VND.Proposal_Remains rr
					ON rr.ProposalItemID = qi.ProposalItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseInvoiceID = @entityId;
		END;

		IF @baseType = 6 -- StockReceipt
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseInvoiceQuantityReceiptBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseInvoiceItem qi
				JOIN STC.StockReceipt_Remains rr
					ON rr.StockReceiptItemID = qi.StockReceiptItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseInvoiceID = @entityId;
		END;

		IF @baseType = 8 -- PurchaseContract
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseInvoicePurchaseContractBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseInvoiceItem qi
				JOIN VND.PurchaseContract_Remains rr
					ON rr.PurchaseContractItemID = qi.PurchaseContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseInvoiceID = @entityId;
		END;

		IF @baseType = 9
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseInvoiceItem qi
				LEFT JOIN
				(
					SELECT pii.ProformaInvoiceItemID,
						   ISNULL(pii.MainQuantity - do1.MainQuantity, 0) AS Non,
						   ISNULL(pii.SubQuantity - do1.SubQuantity, 0) AS NonSub,
						   ISNULL(pii.Price - do1.Price, 0) AS NonPrice
					FROM FOS.ProformaInvoiceItem AS pii
						LEFT JOIN
						(
							SELECT pii2.ProformaInvoiceItemID,
								   SUM(pii2.MainQuantity) MainQuantity,
								   ISNULL(SUM(pii2.SubQuantity), 0) SubQuantity,
								   SUM(pii2.Price) Price
							FROM VND.PurchaseInvoiceItem AS pii2
							GROUP BY pii2.ProformaInvoiceItemID
						) do1
							ON do1.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
				) AS nonProforma
					ON nonProforma.ProformaInvoiceItemID = qi.ProformaInvoiceItemID
			WHERE (
					  nonProforma.Non < 0
					  OR nonProforma.NonSub < 0
					  OR nonProforma.NonPrice < 0
				  )
				  AND qi.PurchaseInvoiceID = @entityId;
		END;

		-- A purchase invoice may not exceed the unit fee of its selected base item.
		IF NOT EXISTS (SELECT 1 FROM @table)
		BEGIN
			IF @baseType = 3 -- Contract
			BEGIN
				INSERT @FeeViolationRows
				SELECT qi.RowIndex
				FROM VND.PurchaseInvoiceItem qi
					JOIN CNT.ContractSubject cs
						ON cs.ContractSubjectID = qi.ContractSubjectID
				WHERE qi.Fee > cs.Fee
					  AND qi.PurchaseInvoiceID = @entityId;
			END;

			ELSE IF @baseType = 5 -- Proposal
			BEGIN
				INSERT @FeeViolationRows
				SELECT qi.RowIndex
				FROM VND.PurchaseInvoiceItem qi
					JOIN VND.ProposalItem pi
						ON pi.ProposalItemID = qi.ProposalItemID
				WHERE qi.Fee > pi.Fee
					  AND qi.PurchaseInvoiceID = @entityId;
			END;

			ELSE IF @baseType = 8 -- PurchaseContract
			BEGIN
				INSERT @FeeViolationRows
				SELECT qi.RowIndex
				FROM VND.PurchaseInvoiceItem qi
					JOIN VND.PurchaseContractItem pci
						ON pci.PurchaseContractItemID = qi.PurchaseContractItemID
				WHERE qi.Fee > pci.Fee
					  AND qi.PurchaseInvoiceID = @entityId;
			END;

			ELSE IF @baseType = 9 -- ProformaInvoice
			BEGIN
				INSERT @FeeViolationRows
				SELECT qi.RowIndex
				FROM VND.PurchaseInvoiceItem qi
					JOIN FOS.ProformaInvoiceItem pfi
						ON pfi.ProformaInvoiceItemID = qi.ProformaInvoiceItemID
				WHERE qi.Fee > pfi.Fee
					  AND qi.PurchaseInvoiceID = @entityId;
			END;
		END;
	END;

	IF @entity = 'JustificationInput'
	BEGIN
		SELECT @baseType = sdtb.BaseEntity
		FROM STC.JustificationInput ji
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		WHERE ji.JustificationInputID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'JustificationInputPurchaseRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.JustificationInputItem qi
				JOIN REQ.PurchaseRequest_Remains rr
					ON rr.PurchaseRequestItemID = qi.PurchaseRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.JustificationInputID = @entityId;
		END;

		ELSE IF @baseType = 3 -- Proposal
		BEGIN
			SET @IncreaseQuantityAccessKey = N'JustificationInputProposalBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.JustificationInputItem qi
				JOIN VND.Proposal_Remains rr
					ON rr.ProposalItemID = qi.ProposalItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.JustificationInputID = @entityId;
		END;

		ELSE IF @baseType = 4 -- TemporaryReceipt
		BEGIN
			SET @IncreaseQuantityAccessKey = N'JustificationInputTemporaryStockReceiptBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.JustificationInputItem qi
				JOIN STC.fn_TemporaryStockReceipt_Remains(null, null, null, 1) rr
					ON rr.TemporaryStockReceiptItemID = qi.TemporaryStockReceiptItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.JustificationInputID = @entityId;
		END;

		ELSE IF @baseType = 8 -- PurchaseContract
		BEGIN
			SET @IncreaseQuantityAccessKey = N'JustificationInputPurchaseContractBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.JustificationInputItem qi
				JOIN VND.PurchaseContract_Remains rr
					ON rr.PurchaseContractItemID = qi.PurchaseContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.JustificationInputID = @entityId;
		END;
	END;

	IF @entity = 'ReceiptCost'
	BEGIN
		INSERT @table
		SELECT pin.Number
		FROM STC.ReceiptCost rc
			JOIN VND.PurchaseInvoiceItem pii
				ON pii.PurchaseInvoiceItemID = rc.PurchaseInvoiceItemID
			JOIN VND.PurchaseInvoice pin
				ON pin.PurchaseInvoiceID = pii.PurchaseInvoiceID
			JOIN VND.PurchaseInvoice_PriceRemains pipr
				ON pipr.PurchaseInvoiceItemID = rc.PurchaseInvoiceItemID
		WHERE StockReceiptID = @entityId
			  AND pipr.Non < 0;
		IF EXISTS (SELECT 1 FROM @table)
		BEGIN

			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );
			SELECT @Message = lsv.[Value]
			FROM CFG.LocalizationSQLMessage ls
				JOIN CFG.LocalizationSQLMessageValue lsv
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
			WHERE ls.SQLMessageCode = 'ReceiptCostBiggerThanBase'
				  AND lsv.Culture = CFG.GetuserCulture();

			RAISERROR(@Message, 16, 12, @RowIndexs);
			RETURN;
		END;


	END;

	IF @entity = 'StockReceipt'
	BEGIN

		SELECT @baseType = sdtb.BaseEntity
		FROM STC.StockReceipt sr
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID

		WHERE StockReceiptID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'QuantityReceiptPurchaseRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.StockReceiptItem qi
				JOIN REQ.PurchaseRequest_Remains rr
					ON rr.PurchaseRequestItemID = qi.PurchaseRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.StockReceiptID = @entityId;
		END;
		ELSE IF @baseType = 3 -- Proposal
		BEGIN
			SET @IncreaseQuantityAccessKey = N'QuantityReceiptProposalBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.StockReceiptItem qi
				JOIN VND.Proposal_Remains rr
					ON rr.ProposalItemID = qi.ProposalItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.StockReceiptID = @entityId;
		END;
		ELSE IF @baseType = 9 -- Transfer
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.StockReceiptItem qi
				LEFT JOIN
				(
					SELECT oi.OutgoingItemID,
						   oi.RowIndex,
						   oi.MainQuantity,
						   oi.SubQuantity,
						   oi.MainQuantity - ISNULL(used1.MainQuantity, 0) AS Non,
						   ISNULL(oi.SubQuantity, 0) - ISNULL(used1.SubQuantity, 0) AS NonSub
					FROM STC.OutgoingItem AS oi
						LEFT JOIN
						(
							SELECT sri.OutgoingItemID,
								   SUM(sri.MainQuantity) MainQuantity,
								   SUM(sri.SubQuantity) SubQuantity
							FROM STC.StockReceiptItem AS sri
							GROUP BY sri.OutgoingItemID
						) used1
							ON used1.OutgoingItemID = oi.OutgoingItemID
				) AS nq
					ON nq.OutgoingItemID = qi.OutgoingItemID
			WHERE (
					  nq.Non < 0
					  AND
					  (
						  nq.SubQuantity IS NULL
						  OR nq.NonSub < 0
					  )
				  )
				  AND qi.StockReceiptID = @entityId;
		END;
		ELSE IF @baseType = 6 -- JustificationInput
		BEGIN
			SET @IncreaseQuantityAccessKey = N'QuantityReceiptJustificationInputBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.StockReceiptItem qi
				JOIN STC.JustificationInput_Remains rr
					ON rr.JustificationInputItemID = qi.JustificationInputItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.StockReceiptID = @entityId;
		END;
		ELSE IF @baseType = 7 -- purchaseInvoice
		BEGIN
			SET @IncreaseQuantityAccessKey = N'QuantityReceiptPurchaseInvoiceBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.StockReceiptItem qi
				JOIN VND.PurchaseInvoice_Remains rr
					ON rr.PurchaseInvoiceItemID = qi.PurchaseInvoiceItemID
				JOIN VND.PurchaseInvoice_PriceRemains pipr
					ON pipr.PurchaseInvoiceItemID = qi.PurchaseInvoiceItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
					  OR pipr.Non < 0
				  )
				  AND qi.StockReceiptID = @entityId;
		END;
		ELSE IF @baseType = 8 -- PurchaseContract
		BEGIN
			SET @IncreaseQuantityAccessKey = N'QuantityReceiptPurchaseContractBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM STC.StockReceiptItem qi
				JOIN VND.PurchaseContract_Remains rr
					ON rr.PurchaseContractItemID = qi.PurchaseContractItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.StockReceiptID = @entityId;
		END;

	END;

	IF @entity = 'ReturnStockReceipt'
	BEGIN

		SELECT src.StockReceiptItemID
		INTO #negativeStockReceipts
		FROM
		(
			SELECT DISTINCT
				   rsri.StockReceiptItemID
			FROM STC.ReturnStockReceiptItem AS rsri
			WHERE rsri.ReturnStockReceiptID = @entityId
		) AS src
			JOIN
			(
				SELECT sri.StockReceiptItemID,
					   sri.MainQuantity - ISNULL(use1.UsedMain, 0) AS Non,
					   ISNULL(sri.SubQuantity, 0) - ISNULL(use1.UsedSubQuantity, 0) AS NonSub
				FROM STC.StockReceiptItem AS sri
					LEFT JOIN
					(
						SELECT rsri.StockReceiptItemID,
							   SUM(rsri.MainQuantity) AS UsedMain,
							   SUM(rsri.SubQuantity) AS UsedSubQuantity
						FROM STC.ReturnStockReceiptItem AS rsri
						GROUP BY rsri.StockReceiptItemID
					) AS use1
						ON use1.StockReceiptItemID = sri.StockReceiptItemID
			) AS remain
				ON remain.StockReceiptItemID = src.StockReceiptItemID
		WHERE remain.Non < 0
			  OR remain.NonSub < 0;


		INSERT @table
		SELECT rsri.RowIndex
		FROM STC.ReturnStockReceiptItem AS rsri
		WHERE rsri.ReturnStockReceiptID = @entityId
			  AND rsri.StockReceiptItemID IN
				  (
					  SELECT StockReceiptItemID FROM #negativeStockReceipts
				  );
	END;

	IF @entity = 'PurchaseContract'
	BEGIN

		SELECT @baseType = BaseType
		FROM VND.PurchaseContract
		WHERE PurchaseContractID = @entityId;

		IF @baseType = 2 -- purchaseRequest
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseContractPurchaseRequestBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseContractItem qi
				JOIN REQ.PurchaseRequest_Remains rr
					ON rr.PurchaseRequestItemID = qi.PurchaseRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseContractID = @entityId;
		END;
		ELSE IF @baseType = 5 -- stuffRequest
		BEGIN
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseContractItem qi
				JOIN REQ.StuffRequest_Remains rr
					ON rr.StuffRequestItemID = qi.StuffRequestItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseContractID = @entityId;
		END;
		ELSE IF @baseType = 7 -- proposal
		BEGIN
			SET @IncreaseQuantityAccessKey = N'PurchaseContractProposalBaseIncreaseQuantity';
			INSERT @table
			SELECT qi.RowIndex
			FROM VND.PurchaseContractItem qi
				JOIN VND.Proposal_Remains rr
					ON rr.ProposalItemID = qi.ProposalItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND qi.PurchaseContractID = @entityId;
		END;

		-- A purchase contract based on a proposal may not exceed its unit fee.
		IF @baseType = 7
		   AND NOT EXISTS (SELECT 1 FROM @table)
		BEGIN
			INSERT @FeeViolationRows
			SELECT qi.RowIndex
			FROM VND.PurchaseContractItem qi
				JOIN VND.ProposalItem pi
					ON pi.ProposalItemID = qi.ProposalItemID
			WHERE qi.Fee > pi.Fee
				  AND qi.PurchaseContractID = @entityId;
		END;

	END;

	IF @entity = 'ReturnedSaleInvoice'
	BEGIN

		SELECT @baseType = rsi.BaseDocument
		FROM SLE.ReturnedSaleInvoice AS rsi
		WHERE rsi.ReturnedSaleInvoiceID = @entityId;

		IF @baseType = 7 --ReturnedSaleJustification
		BEGIN
			INSERT @table
			SELECT rsii.RowIndex
			FROM SLE.ReturnedSaleInvoiceItem AS rsii
				JOIN SLE.ReturnedSaleJustification_Remain AS rsjr
					ON rsjr.ReturnedSaleJustificationItemID = rsii.ReturnedSaleJustificationItemID
			WHERE (
					  Non < 0
					  OR NonSub < 0
					  OR rsjr.NonDiscount < 0
					  OR rsjr.NonPrice < 0
				  )
				  AND rsii.ReturnedSaleInvoiceID = @entityId;
		END;

		IF @baseType = 6 -- Invoice
		BEGIN
			INSERT @table
			SELECT rsii.RowIndex
			FROM SLE.ReturnedSaleInvoiceItem rsii
				JOIN SLE.Invoice_Return_Remains rr
					ON rr.InvoiceItemID = rsii.InvoiceItemID
			WHERE (
					  rr.Non < 0
					  OR rr.NonSub < 0
				  )
				  AND rsii.ReturnedSaleInvoiceID = @entityId;

		END;

		IF EXISTS (SELECT 1 FROM @table)
		BEGIN
			SET @RowIndexs = STUFF(
							 (
								 SELECT DISTINCT
										' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
								 FROM @table tt
								 FOR XML PATH('')
							 ),
							 1,
							 3,
							 ''
								  );

			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
			RETURN;
		END;
	END;

	IF @entity = 'ReturnInvoice'
	BEGIN
		INSERT @table
		SELECT rii.RowIndex
		FROM VND.ReturnInvoiceItem AS rii
			LEFT JOIN
			(
				SELECT pii.PurchaseInvoiceItemID,
					   pii.Discount - r.TotalDiscount AS NonDiscount,
					   pii.MainQuantity - r.TotalMainQuantity AS NonMainQuantity,
					   pii.SubQuantity - r.TotalSubQuantity AS NonSubQuantity
				FROM VND.PurchaseInvoiceItem AS pii
					JOIN
					(
						SELECT rii.PurchaseInvoiceItemID,
							   SUM(rii.Discount) TotalDiscount,
							   SUM(rii.MainQuantity) TotalMainQuantity,
							   SUM(rii.SubQuantity) TotalSubQuantity
						FROM VND.ReturnInvoiceItem AS rii
						GROUP BY rii.PurchaseInvoiceItemID
					) r
						ON r.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
			) s
				ON s.PurchaseInvoiceItemID = rii.PurchaseInvoiceItemID
		WHERE (s.NonDiscount < 0 or s.NonMainQuantity < 0)
			  AND s.PurchaseInvoiceItemID IS NOT NULL
			  AND rii.ReturnInvoiceID = @entityId;

		IF NOT EXISTS (SELECT 1 FROM @table AS t)
		BEGIN
			INSERT @table
			SELECT rii.RowIndex
			FROM VND.ReturnInvoiceItem AS rii
				JOIN
				(
					SELECT rsri.ReturnStockReceiptItemID,
						   rsri.MainQuantity,
						   rsri.SubQuantity,
						   rsri.MainQuantity - ISNULL(USED.MainQuantity, 0) Non,
						   ISNULL(rsri.SubQuantity, 0) - ISNULL(USED.SubQuantity, 0) NonSub
					FROM STC.ReturnStockReceiptItem AS rsri
						LEFT JOIN
						(
							SELECT rii.ReturnStockReceiptItemID,
								   SUM(rii.MainQuantity) MainQuantity,
								   SUM(rii.SubQuantity) SubQuantity
							FROM VND.ReturnInvoiceItem AS rii
							GROUP BY ReturnStockReceiptItemID
						) AS USED
							ON USED.ReturnStockReceiptItemID = rsri.ReturnStockReceiptItemID
				) src
					ON src.ReturnStockReceiptItemID = rii.ReturnStockReceiptItemID
			WHERE src.Non < 0
				  AND
				  (
					  src.SubQuantity IS NULL
					  OR src.NonSub < 0
				  )
				  AND rii.ReturnInvoiceID = @entityId;
		END;

	END;
	
	-- Report fee violations with the same localized message used by other fee checks.
	IF EXISTS (SELECT 1 FROM @FeeViolationRows)
	BEGIN
		SELECT @Message = lsv.[Value]
		FROM CFG.LocalizationSQLMessage ls
			JOIN CFG.LocalizationSQLMessageValue lsv
				ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
		WHERE ls.SQLMessageCode = 'ItemFeeBiggerThanBase'
			  AND lsv.Culture = CFG.GetuserCulture();

		SET @RowIndexs = STUFF(
						 (
							 SELECT DISTINCT
									' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
							 FROM @FeeViolationRows tt
							 FOR XML PATH('')
						 ),
						 1,
						 3,
						 ''
						  );

		RAISERROR(@Message, 16, 12, @RowIndexs);
		RETURN;
	END;

	/** Only continue when there are violations. */
	IF EXISTS (SELECT 1 FROM @table)
	BEGIN

		SET @RowIndexs = STUFF(
				(
							 SELECT DISTINCT
									' , ' + CAST(tt.RowIndex AS NVARCHAR(100))
							 FROM @table tt
							 FOR XML PATH('')
						 ),
				1,
				3,
						 ''
			);

		-- These forms must never allow quantities above their base document,
		-- even when the user has the corresponding increase-quantity permission.
		IF @entity IN (N'Proposal', N'PurchaseContract', N'PurchaseInvoice', N'PurchaseRequest')
			OR @IncreaseQuantityAccessKey IS NULL
		BEGIN
			SET @Message = N'ItemMainQuantityBiggerThanBase^' + @RowIndexs;
			RAISERROR(@Message, 16, 12);
		END
		ELSE
		BEGIN
			-- Other forms may allow the overage when the user has the configured permission.
			-- Map these legacy entity names to the names used by the access configuration.
			IF @entity = 'StockReceipt'
				SET @entity = 'QuantityReceipt';
			ELSE IF @entity = 'Outgoing'
				SET @entity = 'QuantityOutgoing';

			EXEC CFG.CheckAccessToIncreaseBaseQuantity
				@engName = @entity,
				@accessKey = @IncreaseQuantityAccessKey,
				@RowIndexs = @RowIndexs;
		END;
	END;
END;


