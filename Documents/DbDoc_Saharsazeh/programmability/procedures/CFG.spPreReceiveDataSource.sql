
CREATE   PROC  [CFG].[spPreReceiveDataSource]
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
		
	
	SET @Query = N'create table ' + @TableName + 
	    N' 
		(ItemID int not null,
		HeaderID int not null,
		[Type]  Tinyint not null,
		BranchID int,
		[Date] Date not null,
		Number int,
		PreReciveAmount Decimal(36,10) not null,
		DepreciatedAmount Decimal(36,10),
		CurrencyID int not null,
		DlID bigint not null,
		DebitCreditNoteID int,
		InvoiceID int,
		PartyID bigint)'

	EXEC (@Query)

	-------------------Insert PreReceive Originated from ReceiveSubject-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( ItemID,HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PreReciveAmount,
				DepreciatedAmount,
				CurrencyID,
				dlid,
				DebitCreditNoteID,
				InvoiceID,
	    PartyID)    
	 SELECT 
			rs.ReceiveSubjectID,
			rr.ReceiveReceiptID,
			0,
			rr.BranchID,
			rr.[Date],			
			rr.Number,
			rs.Amount PreReciveAmount,
			0 DepreciatedAmount,
			rs.CurrencyID,
			rs.DLID,
			Null,
			Null as InvoiceID,
			p.PartyID
			
FROM   fin.ReceiveSubject            AS rs
       JOIN fin.ReceiptType          AS rt
            ON  rt.ReceiptTypeID = rs.ReceiptTypeID
       JOIN fin.ReceiveReceipt       AS rr
            ON  rr.ReceiveReceiptID = rs.ReceiveReceiptID
            join cfg.party p on rs.dlid=p.DlID
            left join cfg.RecordLevelAccess prla on p.PartyID=prla.entityref and prla.type=1 and  prla.userid=@user
            left join Cfg.RecordLevelAccess brla on rr.BranchID=brla.EntityRef and brla.type=7 and brla.userid=@user
            left join Cfg.RecordLevelAccess frla on rr.FinancialPeriodID=frla.EntityRef and frla.type=18 and frla.userid=@user
            left join #SelectedBranch sb on rr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''RR''+cast(rs.ReceiveSubjectID as Nvarchar(max))

WHERE  rt.[Type] = 1
       
       AND rr.[Date] BETWEEN @FromDate AND @ToDate
       and prla.userid is null
       and brla.userid is null
       and frla.userid is null
       AND (@selectedBranchs is NULL or sb.value IS NOT NULL)
       AND (@SelectedParties is NULL or sp.value IS NOT NULL)
       and (@SelectedDocuments is null or sd.Value IS NOT NULL)
       '

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

-------------------Insert PreReceives Originated from ReceiveSubject and have Deprecieated in DebitCreditNote-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( ItemID,HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PreReciveAmount,
				DepreciatedAmount,
				CurrencyID,
				dlid,
				DebitCreditNoteID,
				InvoiceID,
				PartyID)    
	 SELECT 
			rs.ReceiveSubjectID,
			rr.ReceiveReceiptID,
			0,rr.BranchID,
			rr.[Date],
			rr.Number,
			0 PreReciveAmount,
			dcni.Amount DepreciatedAmount,
			rs.CurrencyID,
			rs.DLID,
			dcni.DebitCreditNoteID,
			Null As InvoiceID,
			p.PartyID
			
FROM   fin.ReceiveSubject            AS rs
       JOIN fin.ReceiptType          AS rt
            ON  rt.ReceiptTypeID = rs.ReceiptTypeID
       JOIN fin.ReceiveReceipt       AS rr
            ON  rr.ReceiveReceiptID = rs.ReceiveReceiptID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  rs.ReceiveSubjectID = dcni.ReceiveSubjectID
        join cfg.Party P on rs.DlID=p.DlID    
            left join cfg.RecordLevelAccess prla on p.PartyID=prla.entityref and prla.type=1 and  prla.userid=@user
            left join Cfg.RecordLevelAccess brla on rr.BranchID=brla.EntityRef and brla.type=7 and brla.userid=@user
            left join Cfg.RecordLevelAccess frla on rr.FinancialPeriodID=frla.EntityRef and frla.type=18 and frla.userid=@user
            left join #SelectedBranch sb on rr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''RR''+cast(rs.ReceiveSubjectID as Nvarchar(max))            
            
WHERE  rt.[Type] = 1
       AND dcni.[Type] = 0
       AND rr.[Date] BETWEEN @FromDate AND @ToDate
       and prla.userid is null
       and brla.userid is null
       and frla.userid is null
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
			
-------------------Insert PreReceives Originated from ReceiveSubject and  have Deprecieated in Invoice-----------------			

	   SET @Query=N'INSERT INTO ' + @TableName +
	    N'(ItemID,
	    HeaderID,
		Type, 
		BranchID,
	    Date,
		Number,
	    PreReciveAmount,
	    DepreciatedAmount,
	    CurrencyID,
	    dlid,
		DebitCreditNoteID,
		InvoiceID,
	    PartyID) 
  SELECT 
	    rs.ReceiveSubjectID,
	    rr.ReceiveReceiptID,
			0,rr.BranchID,
	    rr.[Date],
			rr.Number,
       0,
       ipr.Price,
       rs.CurrencyID,
       rs.DLID,
       Null as DebitCreditNoteID,
       ipr.InvoiceID,
       p.PartyID
FROM   fin.ReceiveSubject            AS rs
       JOIN fin.ReceiptType          AS rt
            ON  rt.ReceiptTypeID = rs.ReceiptTypeID
       JOIN fin.ReceiveReceipt       AS rr
            ON  rr.ReceiveReceiptID = rs.ReceiveReceiptID
        JOIN sle.InvoicePreReceive AS ipr on ipr.ReceiveSubjectID=rs.ReceiveSubjectID  
         join cfg.Party p on rs.DlID=p.DlID   
            left join cfg.RecordLevelAccess prla on p.PartyID=prla.entityref and prla.type=1 and  prla.userid=@user
            left join Cfg.RecordLevelAccess brla on rr.BranchID=brla.EntityRef and brla.type=7 and brla.userid=@user
            left join Cfg.RecordLevelAccess frla on rr.FinancialPeriodID=frla.EntityRef and frla.type=18 and frla.userid=@user
            left join #SelectedBranch sb on rr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''RR''+cast(rs.ReceiveSubjectID as Nvarchar(max))            
WHERE  rt.[Type] = 1
       
   and rr.Date Between @FromDate and @ToDate
       and prla.userid is null
       and brla.userid is null
       and frla.userid is null
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

	-------------------Insert PreReceive Originated from DebitCreditNoteItem-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
		N'	( ItemID,
				HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PreReciveAmount,
				DepreciatedAmount,
				CurrencyID,
				dlid,
				DebitCreditNoteID,
				InvoiceID,
				PartyID)    
	 SELECT 
			rs.DebitCreditNoteItemID,
			rr.DebitCreditNoteID,
			1,
			rr.BranchID,
			rr.[Date],
			rr.Number,
			rs.Amount PreReciveAmount,
			0 DepreciatedAmount,
			rs.CurrencyID,
			p.DLID,
			Null as DestinationDebitCreditNoteID,
			Null as InvoiceID,
			p.PartyID
FROM   cfg.DebitCreditNoteItem            AS rs
       JOIN fin.ReceiptType          AS rt
            ON  rt.ReceiptTypeID = rs.ReceiptTypeID
       JOIN cfg.DebitCreditNote       AS rr
            ON  rr.DebitCreditNoteID = rs.DebitCreditNoteID
            join cfg.Party p on rs.partyid=p.PartyID
            left join cfg.RecordLevelAccess prla on p.PartyID=prla.entityref and prla.type=1 and  prla.userid=@user
            left join Cfg.RecordLevelAccess brla on rr.BranchID=brla.EntityRef and brla.type=7 and brla.userid=@user
            left join Cfg.RecordLevelAccess frla on rr.FinancialPeriodID=frla.EntityRef and frla.type=18 and frla.userid=@user
            left join #SelectedBranch sb on rr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''DCN''+cast(rs.ReceiveSubjectID as Nvarchar(max))    
            

WHERE  rt.[Type] = 1
       and rs.Type=1
       AND rr.[Date] BETWEEN @FromDate AND @ToDate
       and prla.userid is null
       and brla.userid is null
       and frla.userid is null
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

-------------------Insert PreReceives Originated from DebitCreditNote have Deprecieated in DebitCreditNote-----------------
	SET @Query = N'INSERT INTO ' + @TableName +
	    N'	( 
	    		ItemID,
				HeaderID,
				Type, 
				BranchID,
				Date,
				Number,
				PreReciveAmount,
				DepreciatedAmount,
				CurrencyID,
				dlid,
				DebitCreditNoteID,
				InvoiceID,
	    PartyID)    
	 SELECT 
			rs.DebitCreditNoteItemID,
			rr.DebitCreditNoteID,
			1, ---Type
			rr.BranchID,
			rr.[Date],
			rr.Number,
			0 PreReciveAmount,
			dcni.Amount DepreciatedAmount,
			rs.CurrencyID,
			p.DLID,
			dcni.DebitCreditNoteID,
			Null As InvoiceID,
			p.PartyID
			
FROM   cfg.DebitCreditNoteItem            AS rs
       JOIN fin.ReceiptType          AS rt
            ON  rt.ReceiptTypeID = rs.ReceiptTypeID
       JOIN cfg.DebitCreditNote       AS rr
            ON  rr.DebitCreditNoteID = rs.DebitCreditNoteID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  rs.DebitCreditID = dcni.DebitCreditNoteItemID
       join cfg.Party p on rs.PartyID=p.PartyID  
            left join cfg.RecordLevelAccess prla on p.PartyID=prla.entityref and prla.type=1 and  prla.userid=@user
            left join Cfg.RecordLevelAccess brla on rr.BranchID=brla.EntityRef and brla.type=7 and brla.userid=@user
            left join Cfg.RecordLevelAccess frla on rr.FinancialPeriodID=frla.EntityRef and frla.type=18 and frla.userid=@user  
            left join #SelectedBranch sb on rr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''DCN''+cast(rs.ReceiveSubjectID as Nvarchar(max))    
WHERE  rt.[Type] = 1
	   and rs.Type=1
	   and dcni.Type=0
       AND dcni.[Type] = 1
       AND rr.[Date] BETWEEN @FromDate AND @ToDate
	   and prla.userid is null
       and brla.userid is null
       and frla.userid is null
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
			
-------------------Insert PreReceives have Deprecieated in Invoice-----------------			

	   SET @Query=N'INSERT INTO ' + @TableName +
	    N'(ItemID,
	    HeaderID,
		Type, 
		BranchID,
	    Date,
		Number,
	    PreReciveAmount,
	    DepreciatedAmount,
	    CurrencyID,
	    dlid,
		DebitCreditNoteID,
		InvoiceID,
	    PartyID) 
  SELECT 
			rs.DebitCreditNoteItemID,
			rr.DebitCreditNoteID,
			1, ---Type
			rr.BranchID,
			rr.[Date],
			rr.Number,
			0 PreReciveAmount,
			ipr.Price DepreciatedAmount,
			rs.CurrencyID,
			p.DLID,
			null as DebitCreditNoteID,
			ipr.InvoiceID As InvoiceID,
			p.PartyID
			
FROM   cfg.DebitCreditNoteItem            AS rs
       JOIN fin.ReceiptType          AS rt
            ON  rt.ReceiptTypeID = rs.ReceiptTypeID
       JOIN cfg.DebitCreditNote       AS rr
            ON  rr.DebitCreditNoteID = rs.DebitCreditNoteID
       JOIN cfg.DebitCreditNoteItem  AS dcni
            ON  rs.DebitCreditID = dcni.DebitCreditNoteItemID
       JOIN sle.InvoicePreReceive AS ipr on ipr.DebitCreditNoteItemID=rs.DebitCreditNoteItemID 
       join cfg.Party p on rs.PartyID=p.PartyID  
            left join cfg.RecordLevelAccess prla on p.PartyID=prla.entityref and prla.type=1 and  prla.userid=@user
            left join Cfg.RecordLevelAccess brla on rr.BranchID=brla.EntityRef and brla.type=7 and brla.userid=@user
            left join Cfg.RecordLevelAccess frla on rr.FinancialPeriodID=frla.EntityRef and frla.type=18 and frla.userid=@user  
            left join #SelectedBranch sb on rr.BranchID=sb.Value
            left join #SelectedParty sp on p.PartyID=sp.Value
            left join #SelectedDocument sd on sd.Value=''DCN''+cast(rs.ReceiveSubjectID as Nvarchar(max))    
WHERE  rt.[Type] = 1
	   and rs.Type=1
		and rr.Date Between @FromDate and @ToDate
       and prla.userid is null
       and brla.userid is null
       and frla.userid is null   
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
			

END
