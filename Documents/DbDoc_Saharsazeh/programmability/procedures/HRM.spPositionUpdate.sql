-------------------------------------
CREATE   PROC [HRM].[spPositionUpdate] 
    @PositionID INT,
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
     @Code NVARCHAR(50),
    @FlowChartID INT,
    @Specification NVARCHAR(MAX),
    @Specification2 NVARCHAR(MAX),
    @IsManagerToFlowChart BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT
--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 
    SET XACT_ABORT ON  

    IF @Version = (
           SELECT [Version]
           FROM   [HRM].[Position]
           WHERE  [PositionID] = @PositionID
       )
    BEGIN
	    IF EXISTS(SELECT 1 FROM hrm.Position AS p
	              WHERE code=@Code AND p.PositionID<>@PositionID)
	    BEGIN
		     RAISERROR('کد تکراري مي باشد.', 16, 12)
            RETURN;
	    END
	
        UPDATE [HRM].[Position]
        SET    [Title] = @Title,
               [Title2] = @Title2,
               [FlowChartID] = @FlowChartID,
               [Specification] = @Specification,
               [Specification2] = @Specification2,
               [IsManagerToFlowChart] = @IsManagerToFlowChart,
               code = @Code,
               [Creator] = @Creator,
               [CreationDate] = @CreationDate,
               [LastEditor] = @LastEditor,
               [LastEditionDate] = @LastEditionDate,
               [Version] = @Version
        WHERE  [PositionID] = @PositionID
    
        -- Begin Return Select <- do not remove
        SELECT  [Version]
	    FROM   [HRM].[Position]
        WHERE  [PositionID] = @PositionID 
        -- End Return Select <- do not remove 
    END
