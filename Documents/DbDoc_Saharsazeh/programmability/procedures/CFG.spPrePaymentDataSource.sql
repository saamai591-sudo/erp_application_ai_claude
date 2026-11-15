
CREATE   PROC  cfg.spPrePaymentDataSource
		(@TableName NVARCHAR(MAX),
		@FromDate DATE,
		@ToDate DATE,
		@SelectedBranchs NVARCHAR(MAX),
		@SelectedParties NVARCHAR(MAX),
		@SelectedDocuments NVARCHAR(MAX))
AS 
BEGIN
	DECLARE @Query NVARCHAR(MAX),
	@user INT;
	
	SET @user = CFG.GetuserID();
	
	SELECT
		rfcst.[value]
		INTO #SelectedBranch
	FROM
		cfg.R_FnCommaStr2Table(@SelectedBranchs) AS rfcst
		
	SELECT
		rfcst.[value]
		INTO #SelectedParty
	FROM
		cfg.R_FnCommaStr2Table(@SelectedParties) AS rfcst		

	SELECT
		rfcst.[value]
		INTO #SelectedDocument
	FROM
		cfg.R_FnCommaStr2Table(@SelectedDocuments) AS rfcst		
		
		
		SELECT * into #vwPartyAccess           from cfg.vwPartyAccess 
		SELECT * into #vwBranchAccess          from cfg.vwBranchAccess  
		SELECT * into #vwFinancialPeriodAccess from cfg.vwFinancialPeriodAccess	
		
	
	SET @Query = N'create table ' + @TableName + 
	    N' 
		(ItemID int not null,
		HeaderID int not null,
		[Type]  Tinyint not null,
		BranchID int,
		[Date] Date not null,
		Number int,
		PrePaymentAmount Decimal(36,10) not null,
		DepreciatedAmount Decimal(36,10),
		CurrencyID int not null,
		DebitCreditNoteID int,
		PurchaseInvoiceID int,
		PartyID bigint)'

	EXEC (@Query)

	-------------------Insert PrePayment Originated from PaymentSubject-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( ItemID,HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PrePaymentAmount,
				DepreciatedAmount,
				CurrencyID,
				DebitCreditNoteID,
				PurchaseInvoiceID,
				PartyID)    
	 SELECT 
			ps.PaymentSubjectID,
			pr.PaymentReceiptID,
			0,
			pr.BranchID,
			pr.[Date],			
			pr.Number,
			ps.Amount PrePaymentAmount,
			0 DepreciatedAmount,
			ps.CurrencyID,
			Null,
			Null as PurchaseInvoiceID,
			p.PartyID
			
FROM   fin.PaymentSubject            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN fin.PaymentReceipt       AS pr
            ON  pr.PaymentReceiptID = ps.PaymentReceiptID
            join cfg.party p on ps.dlid=p.DlID
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''pr''+cast(ps.PaymentSubjectID as Nvarchar(max))

WHERE  pt.[Type]=10
       
       AND pr.[Date] BETWEEN @FromDate AND @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)'

EXEC sp_executesql @Query,
			N'@Fromdate date,
			@ToDate Date,
			@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments

-------------------Insert PrePayments Originated from PaymentSubject and have Deprecieated in DebitCreditNote-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( ItemID,HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PrePaymentAmount,
				DepreciatedAmount,
				CurrencyID,
				DebitCreditNoteID,
				PurchaseInvoiceID,
				PartyID)    
	 SELECT 
			ps.PaymentSubjectID,
			pr.PaymentReceiptID,
			0,pr.BranchID,
			pr.[Date],
			pr.Number,
			0 PrePaymentAmount,
			dcni.Amount DepreciatedAmount,
			ps.CurrencyID,
			
			dcni.DebitCreditNoteID,
			Null As PurchaseInvoiceID,
			p.PartyID
			
FROM   fin.PaymentSubject            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN fin.PaymentReceipt       AS pr
            ON  pr.PaymentReceiptID = ps.PaymentReceiptID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  ps.PaymentSubjectID = dcni.PaymentSubjectID
        join cfg.Party P on ps.DlID=p.DlID    
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''pr''+cast(ps.PaymentSubjectID as Nvarchar(max))            
            
WHERE  pt.[Type]=10
       AND dcni.[Type] = 1
       AND pr.[Date] BETWEEN @FromDate AND @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)
       '

EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments
	PRINT 3		
-------------------Insert PrePayments Originated from PaymentSubject and  have Deprecieated in Invoice-----------------			

	   SET @Query=N'INSERT INTO ' + @TableName +
	    N'(ItemID,
	    HeaderID,
		Type, 
		BranchID,
	    Date,
		Number,
	    PrePaymentAmount,
	    DepreciatedAmount,
	    CurrencyID,
	  
		DebitCreditNoteID,
		PurchaseInvoiceID,
	    PartyID) 
  SELECT 
	    ps.PaymentSubjectID,
	    pr.PaymentReceiptID,
			0,pr.BranchID,
	    pr.[Date],
			pr.Number,
       0,
       ipr.Price,
       ps.CurrencyID,
       
       Null as DebitCreditNoteID,
       ipr.PurchaseInvoiceID,
       p.PartyID
FROM   fin.PaymentSubject            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN fin.PaymentReceipt       AS pr
            ON  pr.PaymentReceiptID = ps.PaymentReceiptID
        JOIN vnd.PurchaseInvoicePrePayment AS ipr on ipr.PaymentSubjectID=ps.PaymentSubjectID  
         join cfg.Party p on ps.DlID=p.DlID   
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''pr''+cast(ps.PaymentSubjectID as Nvarchar(max))            
WHERE  pt.[Type]=10
       
   and pr.Date Between @FromDate and @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)'
   
EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments

	-------------------Insert PrePayment Originated from DebitCreditNoteItem-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
		N'	( ItemID,
				HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PrePaymentAmount,
				DepreciatedAmount,
				CurrencyID,
				
				DebitCreditNoteID,
				PurchaseInvoiceID,
				PartyID)    
	 SELECT 
			ps.DebitCreditNoteItemID,
			pr.DebitCreditNoteID,
			1,
			pr.BranchID,
			pr.[Date],
			pr.Number,
			ps.Amount PrePaymentAmount,
			0 DepreciatedAmount,
			ps.CurrencyID,
		
			Null as DestinationDebitCreditNoteID,
			Null as PurchaseInvoiceID,
			p.PartyID
FROM   cfg.DebitCreditNoteItem            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN cfg.DebitCreditNote       AS pr
            ON  pr.DebitCreditNoteID = ps.DebitCreditNoteID
            join cfg.Party p on ps.partyid=p.PartyID
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''DCN''+cast(ps.PaymentSubjectID as Nvarchar(max))    
            

WHERE  pt.[Type]=10
       and ps.Type=0
       AND pr.[Date] BETWEEN @FromDate AND @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)'

EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments

-------------------Insert PrePayments Originated from DebitCreditNote have Deprecieated in DebitCreditNote-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( 
	    		ItemID,
				HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PrePaymentAmount,
				DepreciatedAmount,
				CurrencyID,
				
				DebitCreditNoteID,
				PurchaseInvoiceID,
	    PartyID)    
	 SELECT 
			ps.DebitCreditNoteItemID,
			pr.DebitCreditNoteID,
			1, ---Type
			pr.BranchID,
			pr.[Date],
			pr.Number,
			0 PrePaymentAmount,
			dcni.Amount DepreciatedAmount,
			ps.CurrencyID,
		
			dcni.DebitCreditNoteID,
			Null As PurchaseInvoiceID,
			p.PartyID
			
FROM   cfg.DebitCreditNoteItem            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN cfg.DebitCreditNote       AS pr
            ON  pr.DebitCreditNoteID = ps.DebitCreditNoteID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  dcni.DebitCreditID = ps.DebitCreditNoteItemID
       join cfg.Party p on ps.PartyID=p.PartyID  
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user 
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''DCN''+cast(ps.PaymentSubjectID as Nvarchar(max))    
WHERE  pt.[Type]=10
	   and ps.Type=0
	   and dcni.Type=1
       AND pr.[Date] BETWEEN @FromDate AND @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)
'

EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments
			
-------------------Insert PrePayments have Deprecieated in Invoice-----------------			

	   SET @Query=N'INSERT INTO ' + @TableName +
	    N'(ItemID,
	    HeaderID,
		Type, 
		BranchID,
	    Date,
		Number,
	    PrePaymentAmount,
	    DepreciatedAmount,
	    CurrencyID,
	 
		DebitCreditNoteID,
		PurchaseInvoiceID,
	    PartyID) 
  SELECT 
			ps.DebitCreditNoteItemID,
			pr.DebitCreditNoteID,
			1, ---Type
			pr.BranchID,
			pr.[Date],
			pr.Number,
			0 PrePaymentAmount,
			ipr.Price DepreciatedAmount,
			ps.CurrencyID,
		
			null as DebitCreditNoteID,
			ipr.PurchaseInvoiceID As PurchaseInvoiceID,
			p.PartyID
			
FROM   cfg.DebitCreditNoteItem            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN cfg.DebitCreditNote       AS pr
            ON  pr.DebitCreditNoteID = ps.DebitCreditNoteID
       JOIN vnd.PurchaseInvoicePrePayment AS ipr on ipr.DebitCreditNoteItemID=ps.DebitCreditNoteItemID 
       join cfg.Party p on ps.PartyID=p.PartyID  
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user  
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''DCN''+cast(ps.PaymentSubjectID as Nvarchar(max))    
WHERE  pt.[Type]=10
	   and ps.Type=0
		and pr.Date Between @FromDate and @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)
'
   
EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments
			
	
		
	
	-------------------Insert PrePayment Originated from PettyCashCostItem-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( ItemID,HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PrePaymentAmount,
				DepreciatedAmount,
				CurrencyID,
				DebitCreditNoteID,
				PurchaseInvoiceID,
				PartyID)    
	 SELECT 
			ps.PettyCashCostItemID,
			pr.PettyCashCostID,
			3,
			pr.BranchID,
			pr.[Date],			
			pr.Number,
			ps.Amount PrePaymentAmount,
			0 DepreciatedAmount,
			pc.CurrencyID,
			Null,
			Null as PurchaseInvoiceID,
			p.PartyID
			
FROM   fin.PettyCashCostItem            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN fin.PettyCashCost       AS pr
            ON  pr.PettyCashCostID = ps.PettyCashCostID
            join fin.PettyCash pc on pr.PettyCashID=pc.PettyCashID
            join cfg.party p on ps.PartyID=p.PartyID
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''pr''+cast(ps.PettyCashCostItemID as Nvarchar(max))

WHERE  pt.[Type]=10
       
       AND pr.[Date] BETWEEN @FromDate AND @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)'

EXEC sp_executesql @Query,
			N'@Fromdate date,
			@ToDate Date,
			@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments

-------------------Insert PrePayment Originated from PettyCashCostItem and have Deprecieated in DebitCreditNote-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( ItemID,HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PrePaymentAmount,
				DepreciatedAmount,
				CurrencyID,
				DebitCreditNoteID,
				PurchaseInvoiceID,
				PartyID)    
	 SELECT 
			ps.PettyCashCostItemID,
			pr.PettyCashCostID,
			3,
			pr.BranchID,
			pr.[Date],
			pr.Number,
			0 PrePaymentAmount,
			dcni.Amount DepreciatedAmount,
			pc.CurrencyID,
			
			dcni.DebitCreditNoteID,
			Null As PurchaseInvoiceID,
			p.PartyID
			
FROM   fin.PettyCashCostItem            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN fin.PettyCashCost       AS pr
            ON  pr.PettyCashCostID = ps.PettyCashCostID
            join fin.PettyCash pc on pr.PettyCashID=pc.PettyCashID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  ps.PettyCashCostItemID = dcni.PettyCashCostItemID
        join cfg.Party P on ps.PartyID=p.PartyID    
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''pr''+cast(ps.PettyCashCostItemID as Nvarchar(max))            
            
WHERE  pt.[Type]=10
       AND dcni.[Type] = 1
       AND pr.[Date] BETWEEN @FromDate AND @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)
       '

EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments
	PRINT 3		
-------------------Insert PrePayment Originated from PettyCashCostItem and  have Deprecieated in Invoice-----------------			

	   SET @Query=N'INSERT INTO ' + @TableName +
	    N'(ItemID,
	    HeaderID,
		Type, 
		BranchID,
	    Date,
		Number,
	    PrePaymentAmount,
	    DepreciatedAmount,
	    CurrencyID,
	  
		DebitCreditNoteID,
		PurchaseInvoiceID,
	    PartyID) 
  SELECT 
	    ps.PettyCashCostItemID,
	    pr.PettyCashCostID,
			3,
			pr.BranchID,
	    pr.[Date],
			pr.Number,
       0,
       ipr.Price,
       pc.CurrencyID,
       Null as DebitCreditNoteID,
       ipr.PurchaseInvoiceID,
       p.PartyID
FROM   fin.PettyCashCostItem            AS ps
       JOIN fin.PaymentType          As pt
            ON  pt.PaymentTypeID = ps.PaymentTypeID
       JOIN fin.PettyCashCost       AS pr
            ON  pr.PettyCashCostID = ps.PettyCashCostID
            join fin.PettyCash pc on pr.PettyCashID=pc.PettyCashID
        JOIN vnd.PurchaseInvoicePrePayment AS ipr on ipr.PettyCashCostItemID=ps.PettyCashCostItemID  
         join cfg.Party p on ps.PartyID=p.PartyID   
            join #vwPartyAccess AS vpa on p.PartyID=vpa.PartyID and  vpa.userid=@user
            join #vwBranchAccess AS vba  on pr.BranchID=vba.BranchID and vba.userid=@user
            join #vwFinancialPeriodAccess AS vfpa on pr.FinancialPeriodID=vfpa.FinancialPeriodID and vfpa.userid=@user
            left join #SelectedBranch sb on pr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''PCC''+cast(ps.PettyCashCostItemID as Nvarchar(max))            
WHERE  pt.[Type]=10
       
   and pr.Date Between @FromDate and @ToDate
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)'
   
EXEC sp_executesql @Query,
			N'@Fromdate date,@ToDate Date,@user int,
			@SelectedBranchs NVARCHAR(MAX),
			@SelectedParties NVARCHAR(MAX),
			@SelectedDocuments NVARCHAR(MAX)',
			@FromDate=@FromDate,
			@ToDate=@ToDate,
			@user=@user,
			@SelectedBranchs=@SelectedBranchs,
			@SelectedParties=@SelectedParties,
			@SelectedDocuments=@SelectedDocuments
SET @Query=N'select * from '+@TableName
EXEC (@Query)

END
