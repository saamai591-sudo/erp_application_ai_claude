CREATE   proc VND.spPurchaseReviewDataSource
(
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @TableName NVARCHAR(MAX),
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedVendor NVARCHAR(MAX) = NULL,
    @SelectedPurchaseType NVARCHAR(MAX) = NULL,
    @selectedBranch NVARCHAR(MAX) = NULL
)
as 

DECLARE @UserID            INT,
        @Query             NVARCHAR(MAX),
        @basePrecision     INT = CFG.GetBaseCurrencyPrecision();
	
SET @UserID = CFG.GetuserID();
DECLARE @baseCurrencyDecimal     INT,
        @SaleTypeID              INT
        
	
SELECT @baseCurrencyDecimal = PrecisionCount
FROM   cfg.Currency
WHERE  CurrencyID = -1

SELECT *
INTO   #vwPartyAccess
FROM   cfg.vwPartyAccess AS vpa;


SELECT *
INTO   #vwBranchAccess
FROM   cfg.vwBranchAccess;

SELECT VALUE VendorDlID
INTO   #SelectedVendor
FROM   CFG.R_FnCommaStr2Table(@SelectedVendor)

SELECT VALUE StuffID
INTO   #SelectedStuffs
FROM   cfg.R_FnCommaStr2Table(@SelectedStuff) AS rfcst

SELECT VALUE BranchID
INTO   #SelectedBranch
FROM   cfg.R_FnCommaStr2Table(@selectedBranch) AS rfcst

SELECT VALUE PurchaseTypeID
INTO   #SelectedPurchaseType
FROM   cfg.R_FnCommaStr2Table(@SelectedPurchaseType) AS rfcst


set @Query = N'Create table '+@TableName+N' 
(	BranchID   int,
    DocumentID INT,
    SingnedDocumentID NVARCHAR(250),
    DOCUMENT NVARCHAR(MAX),
    PurchaseTypeID INT,
    DlID DECIMAL(36, 10),
    DocumentItemID int,
    RowIndex DECIMAL(36, 10),
    StuffID DECIMAL(36, 10),
    MainQuantity DECIMAL(36, 10),
    SubQuantity  Decimal(36,10),
    Fee DECIMAL(36, 10),
    PurchasePrice DECIMAL(36, 10) ,
    ReturnPrice DECIMAL(36, 10),
    Discount DECIMAL(36, 10),
    Tax			DECIMAL(36, 10),
    Duty		DECIMAL(36, 10),
    Net DECIMAL(36, 10),
    CostOfBuying DECIMAL(36, 10)
)'

EXEC (@Query)

--SELECT * FROM #SelectedVendor

set @Query = N'

insert into '+@TableName+N' 



SELECT pi1.BranchID,
       pi1.PurchaseInvoiceID,
       ''PI'' + CAST(pi1.PurchaseInvoiceID as NVARCHAR(200)) SingnedDocumentID,
       ''PurchaseInvoice'' AS DOCUMENT,
       pi1.[Type]                       PurchaseTypeID,
       pi1.DlID,
       pii.PurchaseInvoiceItemID,
       pii.RowIndex,
       pii.StuffID,
       pii.MainQuantity,    
       pii.SubQuantity,   
		Round( pii.Fee * (CASE
												WHEN c.IsBaseCurrencyBasis = 0 THEN
													pi1.CurrencyRate
												ELSE
													1 / pi1.CurrencyRate
											END
											) / c.ExchangeUnit,
								@baseCurrencyPrecision
       ) Fee,
           Round(pii.Price * (CASE
                                WHEN c.IsBaseCurrencyBasis = 0 THEN
                                    pi1.CurrencyRate
                                ELSE
                                    1 / pi1.CurrencyRate
                            END
                            ) / c.ExchangeUnit,
                @baseCurrencyPrecision
						) Price,
       0,
       - Round( pii.Discount * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Discount,
       Round(pii.Tax * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Tax  ,
      Round( pii.Duty * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Duty ,
       Round(pii.Net * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Net,
       pii.CostOfBuying
FROM   vnd.PurchaseInvoice           AS pi1
		Join cfg.Currency c on pi1.CurrencyID = c.CurrencyID
       JOIN vnd.PurchaseInvoiceItem  AS pii
            ON  pii.PurchaseInvoiceID = pi1.PurchaseInvoiceID
       JOIN #vwPartyAccess              AS vpa
            ON  pi1.DlID = vpa.DlID
       JOIN #vwBranchAccess             AS vba
            ON  pi1.BranchID = vba.BranchID
       left JOIN #SelectedBranch sb
            ON  pi1.BranchID = sb.BranchID
       left JOIN #SelectedStuffs sf
            ON  pii.StuffID = sf.StuffID
       left JOIN #SelectedVendor        AS sv
            ON  pi1.DlID = sv.VendorDlID
       left JOIN #SelectedPurchaseType  AS spt
            ON  pi1.[Type] = spt.PurchaseTypeID
WHERE  pi1.[Date] between @FromDate and @ToDate
       AND (@SelectedStuff is NULL OR sf. StuffID is NOT NULL)
       AND (@selectedBranch is NULL OR sb.BranchID is NOT NULL)
       AND (
               @SelectedPurchaseType is NULL
               OR spt.PurchaseTypeID is NOT NULL
       )
       and (
               @SelectedVendor is NULL
               OR sv.VendorDlID is NOT NULL
       )
       '
           
           
EXECUTE sp_executesql @query,
						N'@FromDate                  DATE,
						@ToDate                   DATE,
						@selectedBranch                    NVARCHAR(MAX) = NULL,
						@SelectedVendor                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedPurchaseType   NVARCHAR(MAX) = NULL,
						@baseCurrencyPrecision TinyInt',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @selectedBranch = @selectedBranch,
     @SelectedVendor = @SelectedVendor,
     @SelectedStuff = @SelectedStuff,
     @SelectedPurchaseType = @SelectedPurchaseType,
     @baseCurrencyPrecision = @basePrecision
     

	 
set @Query = N'

insert into '+@TableName+N' 



SELECT pi1.BranchID,
       pi1.ReturnInvoiceID,
       ''RI'' + CAST(pi1.ReturnInvoiceID as NVARCHAR(200)) SingnedDocumentID,
       ''ReturnInvoice'' AS DOCUMENT,
       pi1.[Type]                       PurchaseTypeID,
       pi1.DlID,
       pii.ReturnInvoiceItemID,
       pii.RowIndex,
       pii.StuffID,
       -pii.MainQuantity,
       -pii.SubQuantity,      
       Round(pii.Fee * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            )
                       Fee,0 PurchasePrice,
           -Round(pii.Price * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            )
                      ReturnPrice,
        Round( pii.Discount * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Discount,
      -Round( pii.Tax * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Tax  ,
       -Round(pii.Duty * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
       ) Duty ,
      - Round(pii.Net * (CASE
                                               WHEN c.IsBaseCurrencyBasis = 0 THEN
                                                   pi1.CurrencyRate
                                               ELSE
                                                   1 / pi1.CurrencyRate
                                           END
                                          ) / c.ExchangeUnit,
                                @baseCurrencyPrecision
                            ) Net,
       0
FROM   vnd.ReturnInvoice           AS pi1
		Join Cfg.Currency c on pi1.CurrencyID = c.CurrencyID
       JOIN vnd.ReturnInvoiceItem  AS pii
            ON  pii.ReturnInvoiceID = pi1.ReturnInvoiceID
       JOIN #vwPartyAccess              AS vpa
            ON  pi1.DlID = vpa.DlID
       JOIN #vwBranchAccess             AS vba
            ON  pi1.BranchID = vba.BranchID
       left JOIN #SelectedBranch sb
            ON  pi1.BranchID = sb.BranchID
       left JOIN #SelectedStuffs sf
            ON  pii.StuffID = sf.StuffID
       left JOIN #SelectedVendor        AS sv
            ON  pi1.DlID = sv.VendorDlID
       left JOIN #SelectedPurchaseType  AS spt
            ON  pi1.[Type] = spt.PurchaseTypeID
WHERE  pi1.[Date] between @FromDate and @ToDate
       AND (@SelectedStuff is NULL OR sf. StuffID is NOT NULL)
       AND (@selectedBranch is NULL OR sb.BranchID is NOT NULL)
       AND (
               @SelectedPurchaseType is NULL
               OR spt.PurchaseTypeID is NOT NULL
       )
          and (
               @SelectedVendor is NULL
               OR sv.VendorDlID is NOT NULL
       )
       '
        
           
EXECUTE sp_executesql @query,
						N'@FromDate                  DATE,
						@ToDate                   DATE,
						@selectedBranch                    NVARCHAR(MAX) = NULL,
						@SelectedVendor                  NVARCHAR(MAX) = NULL,
						@SelectedStuff             NVARCHAR(MAX) = NULL,
						@SelectedPurchaseType   NVARCHAR(MAX) = NULL,
						@baseCurrencyPrecision TinyInt',
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @selectedBranch = @selectedBranch,
     @SelectedVendor = @SelectedVendor,
     @SelectedStuff = @SelectedStuff,
     @SelectedPurchaseType = @SelectedPurchaseType,
	 @baseCurrencyPrecision = @basePrecision
     



print 'End of DataSource'
------------------------------------- END #8753



