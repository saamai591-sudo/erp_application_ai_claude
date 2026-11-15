
CREATE    PROCEDURE [STC].spStockAccountingStuff
(
    @ReviewType INT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedBranch NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS

    DECLARE @User                           INT,
            @tableName                      NVARCHAR(20),
            @tableName1                     NVARCHAR(20),
            @query                          NVARCHAR(MAX),
            @Culture                        VARCHAR(25),
            @CultureNo                      TINYINT,
            @OpeningStockDocumentTypeID     INT,
            @Receipt                        NVARCHAR(100),
            @ReturnReceipt                  NVARCHAR(100),
            @Outgoing                       NVARCHAR(100),
            @ReturnedOutgoing               NVARCHAR(100),
            @StockTransferHasVoucher        NVARCHAR(10),
            @TransferStockReceiptType		INT,
            @TransferOutgoingType			INT;
            
            
  SET @User = CFG.GetuserID();
  
  
  SELECT @StockTransferHasVoucher = c.ConfigValue FROM cfg.Configuration AS c
  WHERE c.ConfigKey = 'TranslationBetweenStocksHasAccountingVoucher'
  
  SELECT @TransferOutgoingType = sdt.StockDocumentTypeID
  FROM   stc.StockDocumentType AS sdt
  WHERE  sdt.DocumentType = 4
         AND sdt.[Type] = 2
  
  SELECT @TransferStockReceiptType = sdt.StockDocumentTypeID
  FROM   stc.StockDocumentType AS sdt
  WHERE  sdt.DocumentType = 5
         AND sdt.[Type] = 1

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;            
	    
SELECT @Receipt = N'''' + lev.[Value] + N''''
FROM CFG.LocalizeEnum le
	JOIN CFG.LocalizeEnumValue lev
		ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'DocumentNumTypes'
	  AND le.Item = 'StockReceipt'
	  AND lev.Culture = @Culture;

SELECT @ReturnReceipt = N'''' + lev.[Value] + N''''
FROM CFG.LocalizeEnum le
	JOIN CFG.LocalizeEnumValue lev
		ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'DocumentNumTypes'
	  AND le.Item = 'ReturnStockReceipt'
	  AND lev.Culture = @Culture;

SELECT @Outgoing = N'''' + lev.[Value] + N''''
FROM CFG.LocalizeEnum le
	JOIN CFG.LocalizeEnumValue lev
		ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'DocumentNumTypes'
	  AND le.Item = 'Outgoing'
	  AND lev.Culture = @Culture;

SELECT @ReturnedOutgoing = N'''' + lev.[Value] + N''''
FROM CFG.LocalizeEnum le
	JOIN CFG.LocalizeEnumValue lev
		ON lev.LocalizeEnumID = le.LocalizeEnumID
WHERE le.Enum = 'DocumentNumTypes'
	  AND le.Item = 'ReturnedOutgoing'
	  AND lev.Culture = @Culture;

        
SELECT @OpeningStockDocumentTypeID = sdt.StockDocumentTypeID FROM stc.StockDocumentType AS sdt
WHERE sdt.[Type] = 1 AND sdt.DocumentType = 7;

    SET @tableName = CFG.getTempTableName(1);
    SET @tableName1 = CFG.getTempTableName(1);

  
  SELECT v.slid,v.SlCode,v.SlTitle,v.SlTitle2 into #vwAccounts FROM acc.vwaccounts AS v
  WHERE v.slid IN (SELECT sagas.InventorySlID FROM stf.StuffAccountGroupAccountSl AS sagas)
    
	SELECT VALUE BranchID
INTO   #SelectedBranch
FROM   CFG.R_FnCommaStr2Table(@SelectedBranch)  

SELECT b.BranchID into
#Branch
FROM cfg.Branch AS b
left join #SelectedBranch AS sb on b.BranchID = sb.BranchID
WHERE (@SelectedBranch is NULL or sb.BranchID is NOT NULL)

	
	exec [STC].RptReviewDataSource 
							@ReviewType = @ReviewType	,
							@FromDate = @FromDate	,
							@ToDate 	= @ToDate,
							@TableName 	= @tableName,
							@SelectedStocks = null 	,
							@SelectedStuffTrace = null	,
							@SelectedStuffAccountGroup 	= @SelectedStuffAccountGroup,
							@SelectedStuffGroup = null	,
							@SelectedStuff = null,
							@Parameter = 'Stuff',
							@StartDateFinancialPeriodID = null
							


SET @query = N'SELECT   ID,	  
						SUM(a.Price) AS Price,
						SUM(a.OriginalPrice) AS OriginalPrice,
						SUM(a.PositiveDeference) AS PositiveDeference,
						SUM(a.NegativeDeference) AS NegativeDeference,
						case when sdt.Type = 1 and a.IsReturn = 0 then ''StockReceipt''
							 when sdt.Type = 1 and a.IsReturn = 1 then ''ReturnStockReceipt''
							 when sdt.Type = 2 and a.IsReturn = 0 then ''Outgoing''
							 when sdt.Type = 2 and a.IsReturn = 1 then ''ReturnOutgoing'' END DocumentType,
							 sdt.StockDocumentTypeID,
							 s.StockTypeID					
				into ' + @tableName1 + '
				FROM ' + @tableName + N' A  
				join stf.Stock s on a.StockID = s.StockID	
				join stc.StockDocumentType sdt on a.StockDocumentTypeID = sdt.StockDocumentTypeID
				join 	#Branch br on s.BranchID = br.BranchID
				 where sdt.StockDocumentTypeID <> @OpeningStockDocumentTypeID	
				 and (	@StockTransferHasVoucher = ''True'' or sdt.StockDocumentTypeID not in (@TransferStockReceiptType,@TransferOutgoingType))
				 GROUP BY A.ID,A.IsReturn,sdt.Type,s.StockTypeID,sdt.StockDocumentTypeID';

				 
				 
				 
EXECUTE sp_executesql @query,
					 N'@OpeningStockDocumentTypeID  int,
					 @StockTransferHasVoucher		NVARCHAR(10),
					 @TransferStockReceiptType		int,
					 @TransferOutgoingType			int    ',
					 @OpeningStockDocumentTypeID = @OpeningStockDocumentTypeID,
					 @StockTransferHasVoucher = @StockTransferHasVoucher,
					 @TransferStockReceiptType = @TransferStockReceiptType,
					 @TransferOutgoingType = @TransferOutgoingType
					 

SELECT * into #vwStuff
FROM stf.VWStuff AS v

SET @query = N'
   select    s.StuffID,
			 s.Code AS StuffCode ,
			 case when @CultureNo = 1 then s.Title else s.Title2  end as StuffTitle,
			 s.StuffAccountGroupCode,					 
			 case when @CultureNo = 1 then s.StuffAccountGroupTitle else s.StuffAccountGroupTitle2  end as StuffAccountGroupTitle,	 
			 case when @CultureNo = 1 then sdt.Title else sdt.Title2  end as StockDocumentType,
			 case when @CultureNo = 1 then st.Title else st.Title2  end as StockTypeTitle,
			 case  a.DocumentType WHEN ''StockReceipt'' then @Receipt
			 when ''ReturnStockReceipt'' then @ReturnReceipt
			 when ''OutGoing'' then @Outgoing
			 when ''ReturnOutgoing'' then @ReturnedOutgoing end DocumentType,
			 va.SlCode,			 
			 case when @CultureNo = 1 then va.SlTitle else va.SlTitle2  end as SlTitle,
			 a.OriginalPrice,A.PositiveDeference,A.NegativeDeference ,a.Price,
			 case  a.DocumentType WHEN ''StockReceipt'' then a.OriginalPrice + a.PositiveDeference
			 when ''ReturnStockReceipt'' then a.NegativeDeference
			 when ''OutGoing'' then -a.NegativeDeference
			 when ''ReturnOutgoing'' then a.OriginalPrice + a.PositiveDeference end Debit,
			  case  a.DocumentType WHEN ''StockReceipt'' then a.NegativeDeference
			 when ''ReturnStockReceipt'' then a.OriginalPrice + a.PositiveDeference
			 when ''OutGoing'' then a.OriginalPrice + a.PositiveDeference
			 when ''ReturnOutgoing'' then a.NegativeDeference end Credit
    FROM     ' + @tableName1 + N' A
    JOIN #vwStuff s ON A.ID = s.StuffID
    JOIN stf.StockType st on a.StockTypeID = st.StockTypeID
    JOIN stc.StockDocumentType sdt on a.StockDocumentTypeID = sdt.StockDocumentTypeID
    left join stf.StuffAccountGroupAccountSl sagas on s.StuffAccountGroupID = sagas.StuffAccountGroupID and st.StockTypeID = sagas.StockTypeID
    left join #vwAccounts va on sagas.InventorySlID = va.SlID ';
   print @query
EXECUTE sp_executesql @query,
					 N'@CultureNo Tinyint,
					 @Receipt                        NVARCHAR(100),
            @ReturnReceipt                  NVARCHAR(100),
            @Outgoing                       NVARCHAR(100),
            @ReturnedOutgoing               NVARCHAR(100)',
					 @CultureNo = @CultureNo,
					 @Receipt = @Receipt,
					 @ReturnReceipt = @ReturnReceipt,
					 @Outgoing = @Outgoing,
					 @ReturnedOutgoing = @ReturnedOutgoing;
