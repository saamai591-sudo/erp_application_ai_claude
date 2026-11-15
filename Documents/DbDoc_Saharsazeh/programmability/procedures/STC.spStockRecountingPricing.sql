
-----------Start of #7747
CREATE      PROCEDURE STC.spStockRecountingPricing
    @StockReceiptId INT,
    @StockRecountingType INT,
    @StockReceiptDate DATE
--WITH ENCRYPTION 
AS
BEGIN
    IF @StockRecountingType = 1 -- آخرین وارده
    BEGIN


        DECLARE @temp2 VARCHAR(100),
                @temp1 VARCHAR(100);

        SET @temp2 = CFG.getTempTableName(1);
        SET @temp1 = CFG.getTempTableName(1);

        DECLARE @Query AS NVARCHAR(MAX),
                @Columns AS NVARCHAR(MAX),
                @ParmDefinition AS NVARCHAR(MAX),
                @innerJoinConditionForDynamicColumns AS NVARCHAR(MAX),
                @SelectListColumns AS NVARCHAR(MAX);

        -- Get dynamic Columns from trace		
        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                   ',' + QUOTENAME(TraceID)
            FROM STF.Trace
            WHERE PricingBase = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                               );

        IF (@Columns IS NULL)
            SET @Columns = N'[-1]';

        -- رسید انبار انتخاب شده
        SET @Query
            = 'SELECT  qri.RowIndex,qri.StuffID,p.*
						INTO ' + @temp1
              + '
						FROM    STC.StockReceipt sr
								INNER JOIN STC.StockReceiptItem qri ON qri.StockReceiptID = sr.StockReceiptID
								LEFT JOIN ( SELECT  qrit.StockReceiptItemID ,
													qrit.TraceID ,
													CASE WHEN qrit.DlID IS NOT NULL THEN CAST(qrit.DlID AS NVARCHAR(MAX))
														 WHEN qrit.TraceItemID IS NOT NULL THEN CAST(qrit.TraceItemID AS NVARCHAR(MAX))
														 ELSE qrit.Value
													END Value
											FROM    STC.StockReceiptItemTrace qrit
										  ) a PIVOT ( MAX(Value) FOR TraceID IN ( ' + @Columns
              + ' ) ) p ON p.StockReceiptItemID = qri.StockReceiptItemID
										  WHERE sr.StockReceiptID = @pStockReceiptId';

        SET @ParmDefinition = N' @pStockReceiptId INT';

        EXEC sp_executesql @Query,
                           @ParmDefinition,
                           @pStockReceiptId = @StockReceiptId;

        SELECT @innerJoinConditionForDynamicColumns
            = N'inner join ' + @temp1 + N' source on source.stuffid = ari.stuffid'
              + STUFF(
        (
            SELECT DISTINCT
                   ' AND (source.' + QUOTENAME(TraceID) + ' is null or p.' + QUOTENAME(TraceID) + '= source.'
                   + QUOTENAME(TraceID) + ')'
            FROM STF.Trace
            WHERE PricingBase = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        0   ,
        ''
                     );

        IF (@innerJoinConditionForDynamicColumns IS NULL)
            SET @innerJoinConditionForDynamicColumns
                = N'inner join ' + @temp1 + N' source on source.stuffid = ari.stuffid';

        SELECT @SelectListColumns = STUFF(
        (
            SELECT DISTINCT
                   ' ,' + QUOTENAME(TraceID)
            FROM STF.Trace
            WHERE PricingBase = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                                         );

        IF (@SelectListColumns IS NULL)
            SET @SelectListColumns = N'';


        --  رسیدانبار های ریالی شده
        SET @Query
            = N'SELECT  ROW_NUMBER() OVER ( PARTITION BY a.RowIndex,a.StuffID ' + @SelectListColumns
              + N'  ORDER BY Date desc ) row_num ,
								*
						INTO    ' + @temp2
              + N'
						FROM    ( SELECT    sr.Date ,
											ari.Fee InvoiceFee,
											ari.StuffID ,
											source.rowindex,
											p.*
								  FROM      STC.StockReceipt sr
											INNER JOIN STC.StockReceiptItem ari ON ari.StockReceiptID = sr.StockReceiptID
											LEFT JOIN ( SELECT  StockReceiptItemID ,TraceID ,
																CASE WHEN DlID IS NOT NULL THEN CAST(DlID AS NVARCHAR(MAX))
																	 WHEN TraceItemID IS NOT NULL THEN CAST(TraceItemID AS NVARCHAR(MAX))
																	 ELSE Value
																END Value
														FROM    STC.StockReceiptItemTrace
													  ) a PIVOT ( MAX(Value) FOR TraceID IN ( ' + @Columns
              + N' ) ) p 
											ON p.StockReceiptItemID = ari.StockReceiptItemID
												' + @innerJoinConditionForDynamicColumns
              + N'
								  WHERE     sr.Date <= @pStockReceiptDate
								  and ari.netprice <> 0
											AND ari.StockReceiptID <> @pStockReceiptId								
								) a	  ';

        SET @ParmDefinition = N' @pStockReceiptId INT , @pStockReceiptDate DATE';

        EXEC sp_executesql @Query,
                           @ParmDefinition,
                           @pStockReceiptId = @StockReceiptId,
                           @pStockReceiptDate = @StockReceiptDate;

        -- Create Inner join condition for dynamic Columns

        DECLARE @Q1 NVARCHAR(MAX);



        SET @Q1 = N'
		select cast(rowindex as int) RowIndex,
		InvoiceFee 		from ' + @temp2 + N'		where row_num = 1';


        EXEC (@Q1);

    END;

    ELSE IF @StockRecountingType = 2 -- آخرین خرید
    BEGIN


        SELECT StuffID,
               RowIndex,
               StockReceiptID
        INTO #tt
        FROM STC.StockReceiptItem
        WHERE StockReceiptID = @StockReceiptId;

        SELECT a.row_num,
               a.StuffID,
               a.Fee,
               a.Date
        INTO #tt2
        FROM
        (
            SELECT ROW_NUMBER() OVER (PARTITION BY pii.StuffID ORDER BY p.Date DESC) row_num,
                   pii.StuffID,
                   pii.Fee,
                   p.Date
            FROM VND.PurchaseInvoice p
                INNER JOIN VND.PurchaseInvoiceItem pii
                    ON pii.PurchaseInvoiceID = p.PurchaseInvoiceID
            WHERE
			p.Date<=@StockReceiptDate and 
			pii.StuffID IN
                  ( SELECT pii.StuffID FROM #tt)
        ) a
        WHERE a.row_num = 1;

        SELECT CAST(t.RowIndex AS INT) RowIndex,
               t2.Fee AS InvoiceFee
        FROM #tt t
            INNER JOIN #tt2 t2
                ON t2.StuffID = t.StuffID;

    END;
END;
