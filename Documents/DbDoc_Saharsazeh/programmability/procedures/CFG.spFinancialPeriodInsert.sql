
CREATE   PROC [CFG].[spFinancialPeriodInsert]
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @StartDate DATETIME ,
    @EndDate DATETIME ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
SET NOCOUNT ON; 
SET XACT_ABORT ON;  
	
DECLARE @lastFinancialPeriod     INT,
        @userId                  INT = CFG.GetuserID(); 

SELECT TOP 1
       @lastFinancialPeriod = fp.FinancialPeriodID
FROM   CFG.FinancialPeriod AS fp
ORDER BY
       fp.StartDate DESC;


INSERT INTO [CFG].[FinancialPeriod]
  (
    [Title],
    [Title2],
    [StartDate],
    [EndDate],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate]
  )
SELECT @Title,
       @Title2,
       @StartDate,
       @EndDate,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate;
	
DECLARE @finPeriodID           INT,
        @documentNumTypeID     SMALLINT;

SET @finPeriodID = SCOPE_IDENTITY();
		
IF @lastFinancialPeriod IS NOT NULL
BEGIN
    INSERT CFG.DocumentNum
      (
        DocumentNumTypeID,
        StartNum,
        EndNum,
        CanNumManually,
        FinancialPeriodID,
        Version,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate
      )
    SELECT dn.DocumentNumTypeID,
           dn.StartNum,
           dn.EndNum,
           dn.CanNumManually,
           @finPeriodID,
           0,
           @userId,
           GETDATE(),
           @userId,
           GETDATE()
    FROM   [CFG].[DocumentNum] AS [dn]
    WHERE  dn.FinancialPeriodID = @lastFinancialPeriod;
    
    INSERT CFG.DocumentNumResetNumberBase
      (
        DocumentNumID,
        DocumentNumResetNumberBaseTypeID,
        Version,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate
      )
    SELECT dn.DocumentNumID,
           b.DocumentNumResetNumberBaseTypeID,
           0,
           @userId,
           GETDATE(),
           @userId,
           GETDATE()
    FROM   CFG.DocumentNum AS dn
           INNER JOIN (
                    SELECT dn.DocumentNumTypeID,
                           dnrnb.DocumentNumResetNumberBaseTypeID
                    FROM   CFG.DocumentNum AS dn
                           JOIN CFG.DocumentNumResetNumberBase AS dnrnb
                                ON  dnrnb.DocumentNumID = dn.DocumentNumID
                    WHERE  dn.FinancialPeriodID = @lastFinancialPeriod
                ) b
                ON  b.DocumentNumTypeID = dn.DocumentNumTypeID
    WHERE  dn.FinancialPeriodID = @finPeriodID;
END;
        ELSE 
BEGIN
	DECLARE db_cursor CURSOR 
	FOR
	    SELECT DocumentNumTypeID
	    FROM   CFG.DocumentNumType
	    WHERE  EngName <> 'RevisionCost'
	           AND EngName <> 'ReceiptCheqeFlow'
	           AND EngName <> 'PaymentCheqeFlow'
	           AND EngName <> 'ReceiveCommitmentRecall'
	           AND EngName <> 'PaymentCommitmentRecall'
	           AND [Type] <> 14
	
	
	OPEN db_cursor 
	FETCH NEXT FROM db_cursor INTO @documentNumTypeID   
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    INSERT INTO [CFG].[DocumentNum]
	      (
	        [DocumentNumTypeID],
	        [StartNum],
	        [EndNum],
	        [CanNumManually],
	        [FinancialPeriodID],
	        [Version],
	        [Creator],
	        [CreationDate],
	        [LastEditor],
	        [LastEditionDate]
	      )
	    SELECT @documentNumTypeID,
	           1,
	           NULL,
	           1,
	           @finPeriodID,
	           0,
	           @Creator,
	           GETDATE(),
	           @Creator,
	           GETDATE()
	    
	    FETCH NEXT FROM db_cursor INTO @documentNumTypeID
	END 
	
	CLOSE db_cursor 
	DEALLOCATE db_cursor
END
	
INSERT INTO [ACC].[VatRate]
  (
    [TaxRate],
    [DutyRate],
    [FinancialPeriodID],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate]
  )
SELECT 0,
       0,
       @finPeriodID,
       0,
       @Creator,
       GETDATE(),
       @Creator,
       GETDATE();



SELECT @finPeriodID AS FinancialPeriodID, 0 as Version
