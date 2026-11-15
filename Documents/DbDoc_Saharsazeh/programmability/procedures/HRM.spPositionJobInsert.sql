CREATE PROC [HRM].[spPositionJobInsert] 
    @PositionID int,
    @JobID int,
    @Vacancy smallint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	INSERT INTO [HRM].[PositionJob] ([PositionID], [JobID], [Vacancy], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @PositionID, @JobID, @Vacancy, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [PositionJobID], [Version]
	FROM   [HRM].[PositionJob]
	WHERE  [PositionJobID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
