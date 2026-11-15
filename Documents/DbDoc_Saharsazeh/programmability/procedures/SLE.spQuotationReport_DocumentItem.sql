-------------------------------------
CREATE   PROC sle.spQuotationReport_DocumentItem
(
    @FromDate DATE,
    @ToDate DATE,
    @SelectedSaleTypes NVARCHAR(MAX) = NULL,
    @SelectedSaleAreas NVARCHAR(MAX) = NULL,
    @SelectedSaleBranchs NVARCHAR(MAX) = NULL,
    @SelectedCustomers NVARCHAR(MAX) = NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedDocuments NVARCHAR(MAX) = NULL
)
as
DECLARE @TableName      NVARCHAR(MAX),
        @FinalTable     NVARCHAR(MAX),
        @Query NVARCHAR(MAX),
        @Culture        NVARCHAR(10),
        @CultureNo      TINYINT,        
            @DateType TINYINT,
            @DateFormat VARCHAR(10);



SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture;

 SELECT @DateType = us.SettingValue
 FROM CFG.UserSetting us
 WHERE us.SettingKey = 'Date_Type'
       AND us.UserID = cfg.GetuserID();

 IF @DateType IS NULL
     SET @DateType = CASE CFG.GetuserCulture()
                         WHEN 'fa' THEN 0
                         WHEN 'en' THEN 1
                         WHEN 'ar' THEN 2
                         ELSE 0
                     END;

 SELECT @DateFormat = us.SettingValue
 FROM CFG.UserSetting us
 WHERE us.SettingKey = 'Date_Format'
       AND us.UserID = cfg.GetuserID();

SET @TableName = cfg.getTempTableName(1)
SET @FinalTable = cfg.getTempTableName(1)

EXEC sle.spQuotationReportDataSource
     @FromDate = @FromDate,
     @ToDate = @ToDate,
     @SelectedStuffs = @SelectedStuffs,
     @SelectedBranchs = @SelectedSaleBranchs,
     @SelectedSaleTypes = @SelectedSaleTypes,
     @SelectedSaleAreas = @SelectedSaleAreas,
     @SelectedCustomers = @SelectedCustomers,
     @SelectedDocuments = @SelectedDocuments,
     @TableName = @TableName,
     @GroupBy = 'QuotationItemID'
	
	
	
SET @Query = 
    N'select
QuotationItemID,
sum(QuotationMainQuantity     ) QuotationMainQuantity,
sum(SaleContractMainQuantity  ) SaleContractMainQuantity,
sum(RemittanceMainQuantity    ) RemittanceMainQuantity,
sum(InvoiceMainQuantity		  ) InvoiceMainQuantity,
sum(OutgoingMainQuantity	  ) OutgoingMainQuantity,
sum(QuotationPrice			  ) QuotationPrice,
sum(SaleContractPrice		  ) SaleContractPrice,
sum(InvoicePrice			  ) InvoicePrice
		into ' + @FinalTable + N'
               from ' + @TableName + N' 
               group by QuotationItemID'
               
EXEC (@Query)   
  
              SELECT * into #vwStuff
              FROM stf.VWStuff AS v

SET @Query = 
    N'select b.QuotationID,qi.QuotationItemID,b.Number, b.QuotationID As DocumentID,''Quotation'' as Document,
    cfg.GetclrSaturnDate(b.Date,@DateFormat,@DateType,0) QuotationDate,
	  case when @CultureNo = 1 then c.Title else c.Title2 end CurrencyTitle,
	  case when @CultureNo = 1 then sa.Title else sa.Title2 end SaleAreaTitle,
	  case when @CultureNo = 1 then st.Title else st.Title2 end SaleTypeTitle,
	  case when @CultureNo = 1 then d.Title else d.Title2 end CustomerDlTitle,	  
	  case when @CultureNo = 1 then br.Title else br.Title2 end BranchTitle,
	  vs.Code StuffCode,	    
	  case when @CultureNo = 1 then vs.Title else vs.Title2 end StuffTitle,	  
	   case when @CultureNo = 1 then vs.StuffGroupTitle else vs.StuffGroupTitle2 end StuffGroupTitle,	   
	   case when @CultureNo = 1 then vs.Title else vs.Title2 end SaleGroupTitle,	   
	   case when @CultureNo = 1 then vs.MainMeasureUnit else vs.MainMeasureUnit2 end MainMeasureUnit,
	   case when @CultureNo = 1 then vs.StuffAccountGroupTitle else vs.StuffAccountGroupTitle2 end StuffAccountGroupTitle,
QuotationMainQuantity,
SaleContractMainQuantity,
RemittanceMainQuantity,
InvoiceMainQuantity,
OutgoingMainQuantity,
QuotationPrice,
SaleContractPrice,
InvoicePrice,
QuotationMainQuantity - isnull(SaleContractMainQuantity,0) NonSaleContractQuantity,
QuotationMainQuantity - isnull(RemittanceMainQuantity,0) NonRemittanceQuantity,
QuotationMainQuantity - isnull(InvoiceMainQuantity,0) NonInvoiceQuantity,
QuotationMainQuantity - isnull(OutgoingMainQuantity,0) NonOutgoingQuantity,
QuotationPrice - isnull(SaleContractPrice,0) NonSaleContractPrice,
QuotationPrice - isnull(InvoicePrice,0) NonInvoicePrice
               from ' + @FinalTable
    + N' a join sle.QuotationItem qi on a.QuotationItemID = qi.QuotationItemID
    join sle.Quotation b on b.QuotationID = qi.QuotationID
    join cfg.Currency c on b.CurrencyID = c.CurrencyID
    join cfg.Party p on b.CustomerID = p.PartyID
    join acc.Dl d on p.DlID = d.DlID
    join sle.SaleArea sa on b.SaleAreaID = sa.SaleAreaID
    join sle.SaleType st on b.SaleTypeID = st.SaleTypeID
    join Cfg.Branch br on b.BranchID = br.BranchID
    join #vwStuff vs on qi.StuffID = vs.StuffID
    
    '
	EXECUTE sp_executesql @query,
     N'@CultureNo			TinyInt,
     @DateFormat NVarchar(20),
     @DateType   Tinyint 
     ',
     @CultureNo = @CultureNo,
     @DateFormat = @DateFormat,
     @DateType = @DateType
               

