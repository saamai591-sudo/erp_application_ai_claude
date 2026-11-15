
------------------------------------- START #65466
CREATE   PROCEDURE STC.GetNonOutgoingForInvoice 
(
    @Date         DATE,
    @ids          NVARCHAR(MAX),
    @dlId         INT,
    @stuffId      INT = NULL,
    @branchId     INT
)
--WITH ENCRYPTION
AS
set NOCOUNT ON
BEGIN
	DECLARE @SelectColumns          NVARCHAR(MAX),
	        @UserID                 INT,
	        @DateType               TINYINT,
	        @DateFormat             VARCHAR(10),
	        @Culture                VARCHAR(10),
	        @DynamicColumns         NVARCHAR(MAX),
	        @CodeAndTitleColumn     NVARCHAR(MAX),
	        @LeftJoin               NVARCHAR(MAX),
	        @query                  NVARCHAR(MAX),
	        @basePrecisionCount     SMALLINT;
	
	IF (@ids = '')
	    SET @ids = NULL;
	
	SELECT @basePrecisionCount = c.PrecisionCount
	FROM   CFG.Currency AS c
	WHERE  c.CurrencyID = -1;
	
	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID;
	
	IF @DateType IS NULL
	   OR @DateType = ''
	BEGIN
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END;
	END;
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID;
	
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD';
	
	SELECT @DynamicColumns = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@DynamicColumns IS NULL)
	    SET @DynamicColumns = '[-1]';
	
	SELECT @SelectColumns = STUFF(
	           (
	               SELECT DISTINCT
	                      CASE 
	                           WHEN AccountLevelTypeID = 6 THEN ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + 
	                                ' AS TR'
	                                + CAST(TraceID AS VARCHAR(5)) + ',trI' + CAST(TraceID AS VARCHAR(5))
	                                + '.Item AS TRCode' + CAST(TraceID AS VARCHAR(5))
	                           WHEN AccountLevelTypeID <> 5 THEN ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + 
	                                ' AS TR'
	                                + CAST(TraceID AS VARCHAR(5))
	                           ELSE ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR'
	                                + CAST(TraceID AS VARCHAR(5)) + ',CFG.GetCLRSaturnDate(Piv.'
	                                + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ', @DateFormat, 0, @DateType) AS TRDate'
	                                + CAST(TraceID AS VARCHAR(5))
	                      END
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	IF (@SelectColumns IS NULL)
	    SET @SelectColumns = '[-1]';
	
	SELECT @CodeAndTitleColumn = STUFF(
	           (
	               SELECT DISTINCT ' ,d' + CAST(TraceID AS VARCHAR(10))
	                      + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10))
	                      + '],d' + CAST(TraceID AS VARCHAR(10))
	                      + '.Title [TRTitle'
	                      + CAST(TraceID AS VARCHAR(10)) + ']'
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @CodeAndTitleColumn IS NULL
	    SET @CodeAndTitleColumn = ' ';
	
	SELECT @LeftJoin = STUFF(
	           (
	               SELECT DISTINCT ' Left Join ACC.DL d'
	                      + CAST(TraceID AS VARCHAR(10)) + ' on d'
	                      + CAST(TraceID AS VARCHAR(10)) + '.DlID = piv.'
	                      + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @LeftJoin IS NULL
	    SET @LeftJoin = ' ';
	
	DECLARE @ListLeftJoin NVARCHAR(MAX)
	
	SELECT @ListLeftJoin = STUFF(
	           (
	               SELECT ' Left Join STF.TraceItem trI' + CAST(TraceID AS VARCHAR(10)) + ' on trI' + CAST(TraceID AS VARCHAR(10))
	                      + '.TraceItemID = piv.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  AccountLevelTypeID = 6
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	IF (@ListLeftJoin IS NULL)
	    SET @ListLeftJoin = N'';
	    
	    print sysdatetime()
	    print 1
	    SELECT * into #Outgoing_Remains
	     FROM  sle.Outgoing_Remains
	    WHERE DeliverDlID = @dlId
	    and [Date]<=@Date
	    and Non > 0
	    
	    print sysdatetime()
	    print 2
	    SELECT jni.JustificationItemID,jni.CurrencyID, jni.MainQuantity,
	           jni.SubQuantity, jni.Fee, jni.DoMainQuantity, jni.DoSubQuantity,
	           jni.Non, jni.SubNon, jni.Price, jni.Discount, jni.NonPrice,
	           jni.NonDiscount into #Justification_Non_Invoice 
	      FROM sle.Justification_Non_Invoice jni
	    WHERE [Date] <= @Date
	    and DlID = @dlId 
	    

	    SELECT * into #Quotation_Non_Invoice
	     FROM [SLE].[Quotation_Non_Invoice] qni
	    WHERE qni.DlID = @dlId and qni.[Date] <=@Date

	    SELECT * into #SaleContract_Non_Invoice
	    FROM sle.SaleContract_Non_Invoice AS scni
	    WHERE scni.[Date] <=@Date and scni.DlID = @dlId
   
	    SELECT * into #vwStockAccess
	     FROM cfg.vwStockAccess AS vsa
	     
	   
	     
	     SELECT oi.OutgoingItemID,
	            sdtb.BaseEntity,
	            oi.RowIndex,
	            o.OutgoingID,
	            o.Number,
	            CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) DateString,
	            oi.StuffID,
	            s.Code          StuffCode,
	            s.Title         StuffTitle,
	            oi.MainQuantity,
	            oi.SubQuantity,
	            ore.Non,
	            ore.NonSub,o.[Date],o.DeliverDlID,sdt.DocumentType,
	            CASE 
	                 WHEN oi.JustificationItemID IS NOT NULL THEN CASE 
	                                                                   WHEN jni.Non = ore.Non THEN jni.NonPrice
	                                                                   ELSE ROUND(
	                                                                            (jni.Price / jni.MainQuantity) * ore.Non,
	                                                                            @basePrecisionCount
	                                                                        )
	                                                              END
	                 WHEN oi.QuotationItemID IS NOT NULL THEN CASE 
	                                                               WHEN qni.Non = ore.Non THEN qni.NonPrice
	                                                               ELSE ROUND(
	                                                                        (qni.Price / qni.MainQuantity) * ore.Non,
	                                                                        @basePrecisionCount
	                                                                    )
	                                                          END
	                 WHEN ri.JustificationItemID IS NOT NULL THEN CASE 
	                                                                   WHEN jni1.Non = ore.Non THEN jni1.NonPrice
	                                                                   ELSE ROUND(
	                                                                            (jni1.Price / jni1.MainQuantity) * 
	                                                                            ore.Non,
	                                                                            @basePrecisionCount
	                                                                        )
	                                                              END
	                 WHEN ri.QuotationItemID IS NOT NULL THEN CASE 
	                                                               WHEN qni2.Non = ore.Non THEN qni2.NonPrice
	                                                               ELSE ROUND(
	                                                                        (qni2.Price / qni2.MainQuantity) * ore.Non,
	                                                                        @basePrecisionCount
	                                                                    )
	                                                          END
	                 WHEN sci.SaleContractItemID IS NOT NULL THEN CASE 
	                                                                   WHEN sndi.Non = ore.Non THEN sndi.NonPrice
	                                                                   ELSE ROUND(
	                                                                            (sndi.Price / sndi.MainQuantity) * 
	                                                                            ore.Non,
	                                                                            @basePrecisionCount
	                                                                        )
	                                                              END
	                 WHEN sci2.SaleContractItemID IS NOT NULL THEN CASE 
	                                                                    WHEN sndi2.Non = ore.Non THEN sndi2.NonPrice
	                                                                    ELSE ROUND(
	                                                                             (sndi2.Price / sndi2.MainQuantity) * 
	                                                                             ore.Non,
	                                                                             @basePrecisionCount
	                                                                         )
	                                                               END
	                 ELSE 0
	            END             NonPrice,
	            CASE 
	                 WHEN oi.JustificationItemID IS NOT NULL THEN ji.SaleModelID
	                 WHEN oi.QuotationItemID IS NOT NULL THEN qi.SaleModelID
	                 WHEN ri.JustificationItemID IS NOT NULL THEN jir.SaleModelID
	                 WHEN ri.QuotationItemID IS NOT NULL THEN qr.SaleModelID
	                 WHEN sci.SaleContractItemID IS NOT NULL THEN sci.SaleModelID
	                 WHEN sci2.SaleContractItemID IS NOT NULL THEN sci2.SaleModelID
	                 ELSE NULL
	            END             SaleModelID,
	            CASE 
	                 WHEN oi.JustificationItemID IS NOT NULL THEN CASE 
	                                                                   WHEN jni.Non = ore.Non THEN jni.NonDiscount
	                                                                   ELSE ROUND(
	                                                                            (jni.Discount / jni.MainQuantity) * 
	                                                                            ore.Non,
	                                                                            @basePrecisionCount
	                                                                        )
	                                                              END
	                 WHEN oi.QuotationItemID IS NOT NULL THEN CASE 
	                                                               WHEN qni.Non = ore.Non THEN qni.NonDiscount
	                                                               ELSE ROUND(
	                                                                        (qni.Discount / qni.MainQuantity) * ore.Non,
	                                                                        @basePrecisionCount
	                                                                    )
	                                                          END
	                 WHEN ri.JustificationItemID IS NOT NULL THEN CASE 
	                                                                   WHEN jni1.Non = ore.Non THEN jni1.NonDiscount
	                                                                   ELSE ROUND(
	                                                                            (jni1.Discount / jni1.MainQuantity) * 
	                                                                            ore.Non,
	                                                                            @basePrecisionCount
	                                                                        )
	                                                              END
	                 WHEN ri.QuotationItemID IS NOT NULL THEN CASE 
	                                                               WHEN qni2.Non = ore.Non THEN qni2.NonDiscount
	                                                               ELSE ROUND(
	                                                                        (qni2.Discount / qni2.MainQuantity) * ore.Non,
	                                                                        @basePrecisionCount
	                                                                    )
	                                                          END
	                 WHEN sci.SaleContractItemID IS NOT NULL THEN CASE 
	                                                                   WHEN sndi.Non = ore.Non THEN sndi.NonDiscount
	                                                                   ELSE ROUND(
	                                                                            (sndi.Discount / sndi.MainQuantity) * 
	                                                                            ore.Non,
	                                                                            @basePrecisionCount
	                                                                        )
	                                                              END
	                 WHEN sci2.SaleContractItemID IS NOT NULL THEN CASE 
	                                                                    WHEN sndi2.Non = ore.Non THEN sndi2.NonDiscount
	                                                                    ELSE ROUND(
	                                                                             (sndi2.Discount / sndi2.MainQuantity) * 
	                                                                             ore.Non,
	                                                                             @basePrecisionCount
	                                                                         )
	                                                               END
	                 ELSE 0
	            END             NonDiscount,
	            CASE 
	                 WHEN oi.JustificationItemID IS NOT NULL THEN jni.Price
	                 WHEN oi.QuotationItemID IS NOT NULL THEN qni.Price
	                 WHEN ri.JustificationItemID IS NOT NULL THEN jni1.Price
	                 WHEN ri.QuotationItemID IS NOT NULL THEN qni2.Price
	                 WHEN sci.SaleContractItemID IS NOT NULL THEN sndi.Price
	                 WHEN sci2.SaleContractItemID IS NOT NULL THEN sndi2.Price
	                 ELSE 0
	            END             BasePrice,
	            CASE 
	                 WHEN oi.JustificationItemID IS NOT NULL THEN jni.Discount
	                 WHEN oi.QuotationItemID IS NOT NULL THEN qni.Discount
	                 WHEN ri.JustificationItemID IS NOT NULL THEN jni1.Discount
	                 WHEN ri.QuotationItemID IS NOT NULL THEN qni2.Discount
	                 WHEN sci.SaleContractItemID IS NOT NULL THEN sndi.Discount
	                 WHEN sci2.SaleContractItemID IS NOT NULL THEN sndi2.Discount
	                 ELSE 0
	            END             BaseDiscount,
	            CASE 
	                 WHEN oi.JustificationItemID IS NOT NULL THEN jni.MainQuantity
	                 WHEN oi.QuotationItemID IS NOT NULL THEN qni.MainQuantity
	                 WHEN ri.JustificationItemID IS NOT NULL THEN jni1.MainQuantity
	                 WHEN ri.QuotationItemID IS NOT NULL THEN qni2.MainQuantity
	                 WHEN sci.SaleContractItemID IS NOT NULL THEN sndi.MainQuantity
	                 WHEN sci2.SaleContractItemID IS NOT NULL THEN sndi2.MainQuantity
	                 ELSE 0
	            END             BaseMainQuantity,
	            CAST(0.0000000000 as DECIMAL(36,10))     Fee,
	            st.BranchID,
	            oi.InvoiceItemID
	            into #Src
FROM   STC.OutgoingItem oi
        JOIN STC.Outgoing o ON o.OutgoingID = oi.OutgoingID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STF.Stock st ON st.StockID = o.StockID
        JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN #Outgoing_Remains ore ON ore.OutgoingItemID = oi.OutgoingItemID
        JOIN STF.[Stuff] s ON s.StuffID = oi.StuffID
        LEFT JOIN SLE.JustificationItem ji ON ji.JustificationItemID = oi.JustificationItemID
		LEFT JOIN #Justification_Non_Invoice jni ON jni.JustificationItemID  =ji.JustificationItemID
        LEFT JOIN SLE.QuotationItem qi ON qi.QuotationItemID = oi.QuotationItemID
		LEFT JOIN #Quotation_Non_Invoice qni ON qni.QuotationItemID = qi.QuotationItemID
        LEFT JOIN SLE.RemittanceItem ri ON ri.RemittanceItemID = oi.RemittanceItemID
		LEFT JOIN SLE.JustificationItem jir ON jir.JustificationItemID = ri.JustificationItemID
		LEFT JOIN #Justification_Non_Invoice jni1 ON jni1.JustificationItemID  =ri.JustificationItemID
        LEFT JOIN SLE.QuotationItem qr ON qr.QuotationItemID = ri.QuotationItemID
		LEFT JOIN #Quotation_Non_Invoice qni2 ON qni2.QuotationItemID = qr.QuotationItemID
		LEFT JOIN SLE.SaleContractItem AS sci ON sci.SaleContractItemID = oi.SaleContractItemID
		LEFT join #SaleContract_Non_Invoice as sndi on sndi.SaleContractItemID = sci.SaleContractItemID
		LEFT JOIN SLE.RemittanceItem AS ri2 ON oi.RemittanceItemID = ri2.RemittanceItemID
		LEFT JOIN SLE.SaleContractItem AS sci2 ON sci2.SaleContractItemID = ri2.SaleContractItemID
		LEFT join #SaleContract_Non_Invoice as sndi2 on sndi2.SaleContractItemID = sci2.SaleContractItemID
		INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = o.StockID
WHERE   ore.Non > 0 		AND st.BranchID = @branchId         AND oi.InvoiceItemID IS NULL          AND ri.InvoiceItemID IS NULL
       AND o.[Date] <= @Date         AND o.DeliverDlID = @dlId         AND (sdt.DocumentType = 1    or sdt.DocumentType=10)
            AND ( @stuffId IS NULL               OR oi.StuffID = @stuffId
           )   
	  
	   
	UPDATE #Src
	set Fee = CASE WHEN non>0 then CONVERT(FLOAT, NonPrice)/convert(float,Non)  else fee END
	
	
	
	
	SET @query = 
	    'SELECT  src.OutgoingItemID ,src.BaseEntity  ,src.RowIndex, src.OutgoingID , src.Number , CFG.GetCLRSaturnDate(src.[Date],@DateFormat, 0, @DateType) DateString, 
		src.StuffID , src.StuffCode ,    src.StuffTitle , src.MainQuantity , src.SubQuantity , src.Non , src.NonSub , 
		src.NonPrice, 		
		 src.SaleModelID,     
		   src.NonDiscount,
		SRC.BasePrice, 	src.BaseDiscount,src.BaseMainQuantity, 	
		src.Fee,'
	
	
	SET @query = @query + @SelectColumns + ',0' + @CodeAndTitleColumn + 
	    '	
 FROM   #Src src
		LEFT JOIN (SELECT tr.OutgoingItemID , 
					   tr.TraceID ,
					   CASE 
							WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
							WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX)) 
							ELSE tr.Value
					   END Value
					   FROM STC.OutgoingItemTrace tr
				) x
				PIVOT (
					MAX(Value)
					FOR TraceID IN ( ' + @DynamicColumns
	    + ')
				) AS piv ON piv.OutgoingItemID = src.OutgoingItemID
				' + @LeftJoin + ' ' + @ListLeftJoin
	   
      ;

	
	EXEC sp_executesql @query,
	     N'
			@Date DATE ,
			@dlId INT,
			@stuffId int ,
			@ids NVARCHAR(MAX) ,			
			@UserID INT,
			@DateFormat nvarchar(20),
			@DateType TINYINT	,
			@branchId int	,
			@basePrecisionCount SMALLINT
		',
	     @Date = @Date,
	     @dlId = @dlId,
	     @stuffId = @stuffId,
	     @ids = @ids,
	     @UserID = @UserID,
	     @DateFormat = @DateFormat,
	     @DateType = @DateType,
	     @branchId = @branchId,
	     @basePrecisionCount = @basePrecisionCount;
END;
