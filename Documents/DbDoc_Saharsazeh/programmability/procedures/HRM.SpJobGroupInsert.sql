CREATE PROC [HRM].[SpJobGroupInsert] 
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
    @Code  NVARCHAR(50),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
	
    IF EXISTS (
           SELECT 1
           FROM   hrm.JobGroup AS j
           WHERE  j.Code = @Code
       )
    BEGIN
        RAISERROR('کد تکراري مي باشد.', 16, 12)
        RETURN
    END
	
    INSERT INTO [HRM].[JobGroup]
      (
        [Title],
        [Title2],
        Code,
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @Title,
           @Title2,
           @Code,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
	    -- Begin Return Select <- do not remove
    SELECT [JobGroupID],
           [Version]
    FROM   [HRM].[JobGroup]
    WHERE  [JobGroupID] = SCOPE_IDENTITY()
           -- End Return Select <- do not remove
