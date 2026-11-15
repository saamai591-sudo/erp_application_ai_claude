CREATE PROC [HRM].[SpConfirmationTypeInsert] 
    @ConfirmationFormID TINYINT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @HasReciver BIT,
    @HasAmount BIT,
    @HasInstallmentAmount BIT,
    @HasDescription BIT,
    @HasReciverPerson BIT,
    @HasValue1 BIT,
    @HasValue2 BIT,
    @HasValue3 BIT,
    @SaturnReportID INT = NULL,
    @FromNumber INT ,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
	
    INSERT INTO [HRM].[ConfirmationType]
      (
        [ConfirmationFormID],
        [Title],
        [Title2],
        [HasReciver],
        [HasAmount],
        [HasInstallmentAmount],
        [HasDescription],
        [HasReciverPerson],
        [HasValue1],
        [HasValue2],
        [HasValue3],
        [SaturnReportID],FromNumber,
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @ConfirmationFormID,
           @Title,
           @Title2,
           @HasReciver,
           @HasAmount,
           @HasInstallmentAmount,
           @HasDescription,
           @HasReciverPerson,
           @HasValue1,
           @HasValue2,
           @HasValue3,
           @SaturnReportID,@FromNumber,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
	-- Begin Return Select <- do not remove
    SELECT [ConfirmationTypeID],
           [Version]
    FROM   [HRM].[ConfirmationType]
    WHERE  [ConfirmationTypeID] = SCOPE_IDENTITY()
     -- End Return Select <- do not remove
