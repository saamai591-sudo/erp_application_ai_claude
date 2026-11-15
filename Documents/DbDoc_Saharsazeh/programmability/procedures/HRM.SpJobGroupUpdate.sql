CREATE PROC [HRM].[SpJobGroupUpdate] 
    @JobGroupID TINYINT,
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
    @Code  NVARCHAR(50),
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
       FROM   [HRM].[JobGroup]
       WHERE  [JobGroupID] = @JobGroupID
   )
BEGIN
    RAISERROR('Version mismatch...', 16, 10)
    RETURN
END

IF EXISTS (
       SELECT 1
       FROM   hrm.JobGroup AS j
       WHERE  j.Code = @Code
              AND j.JobGroupID <> @JobGroupID
   )
BEGIN
    RAISERROR('کد تکراري مي باشد.', 16, 12)
    RETURN
END

SET @Version = @Version + 1 

UPDATE [HRM].[JobGroup]
SET    [Title] = @Title,
       [Title2] = @Title2,
       code=@Code,
       [Creator] = @Creator,
       [CreationDate] = @CreationDate,
       [LastEditor] = @LastEditor,
       [LastEditionDate] = @LastEditionDate,
       [Version] = @Version
WHERE  [JobGroupID] = @JobGroupID
	
		-- Begin Return Select <- do not remove
SELECT  [Version]
		FROM   [HRM].[JobGroup]
WHERE  [JobGroupID] = @JobGroupID 
       -- End Return Select <- do not remove
