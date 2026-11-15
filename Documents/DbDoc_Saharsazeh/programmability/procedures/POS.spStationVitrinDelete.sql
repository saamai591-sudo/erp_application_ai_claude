CREATE PROC [POS].[spStationVitrinDelete] 
    @StationVitrinID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [POS].[StationVitrin]
	where [StationVitrinID] = @StationVitrinID)
	begin	



		DELETE
		FROM   [POS].[StationVitrin]
		WHERE  [StationVitrinID] = @StationVitrinID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'StationVitrin', -- First argument.
		@StationVitrinID); -- Second argument.)
	end

