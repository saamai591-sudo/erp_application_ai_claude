CREATE PROC [HRM].[SpConfirmationTypeUpdate] 
    @ConfirmationTypeID INT,
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
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 

    IF @Version <> (
           SELECT [Version]
           FROM   [HRM].[ConfirmationType]
           WHERE  [ConfirmationTypeID] = @ConfirmationTypeID
       )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10)
        RETURN
    END

     IF EXISTS (SELECT 1 FROM hrm.Confirmation c
                WHERE c.ConfirmationTypeID=@ConfirmationTypeID 
     AND c.Number>@FromNumber)
        BEGIN
            RAISERROR('گواهي با شماره بزرگتر ار شماره شروع ثبت شده است.', 16, 12)
            RETURN
        END

    SET @Version = @Version + 1 

    UPDATE [HRM].[ConfirmationType]
    SET    [ConfirmationFormID] = @ConfirmationFormID,
           [Title] = @Title,
           [Title2] = @Title2,
           [HasReciver] = @HasReciver,
           [HasAmount] = @HasAmount,
           [HasInstallmentAmount] = @HasInstallmentAmount,
           [HasDescription] = @HasDescription,
           [HasReciverPerson] = @HasReciverPerson,
           [HasValue1] = @HasValue1,
           [HasValue2] = @HasValue2,
           [HasValue3] = @HasValue3,
           [SaturnReportID] = @SaturnReportID,
          FromNumber = @FromNumber,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate,
           [Version] = @Version
    WHERE  [ConfirmationTypeID] = @ConfirmationTypeID
	
		    -- Begin Return Select <- do not remove
    SELECT  [Version]
		    FROM   [HRM].[ConfirmationType]
    WHERE  [ConfirmationTypeID] = @ConfirmationTypeID 
           -- End Return Select <- do not remove
